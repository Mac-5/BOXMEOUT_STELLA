"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useMarket } from "@/hooks/useMarket";
import { useMarketBets } from "@/hooks/useMarketBets";
import { useMarketEvents } from "@/hooks/useMarketEvents";
import { Market, Bet } from "@/lib/api";
import { FighterCard } from "@/components/FighterCard";
import { BetForm } from "@/components/BetForm";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { DisputeModal } from "@/components/DisputeModal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

// recharts is only needed on this page; keep it out of the shared bundle
const OutcomeChart = dynamic(() => import("@/components/OutcomeChart").then((m) => m.OutcomeChart), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="chart" />,
});
const MarketOddsChart = dynamic(
  () => import("@/components/MarketOddsChart").then((m) => m.MarketOddsChart),
  { ssr: false, loading: () => <LoadingSkeleton variant="chart" /> }
);

const DISPUTE_WINDOW_SEC = 24 * 60 * 60; // 24 h

function isInDisputeWindow(market: Market): boolean {
  if (market.status !== "Resolved") return false;
  // scheduledAt is the closest proxy for resolvedAt we have on the type
  const resolvedAt = new Date(market.scheduledAt).getTime();
  return Date.now() - resolvedAt < DISPUTE_WINDOW_SEC * 1000;
}

function BetHistoryRow({ bet }: { bet: Bet }): JSX.Element {
  const xlm = (Number(BigInt(bet.amount)) / 1e7).toFixed(2);
  return (
    <tr className="border-b border-gray-700 text-sm">
      <td className="py-2 pr-4 text-gray-300 font-mono text-xs truncate max-w-[120px]">{bet.bettor}</td>
      <td className={`py-2 pr-4 font-medium ${bet.side === "FighterA" ? "text-blue-400" : "text-red-400"}`}>
        {bet.side === "FighterA" ? "Fighter A" : "Fighter B"}
      </td>
      <td className="py-2 pr-4 text-white">{xlm} XLM</td>
      <td className="py-2 text-gray-400 text-xs">{new Date(bet.placedAt).toLocaleString()}</td>
    </tr>
  );
}

export interface MarketDetailClientProps {
  marketId: string;
  initialMarket: Market;
  initialBets: Bet[];
  initialOddsHistory: import("@/lib/api").OddsSnapshot[];
}

export function MarketDetailClient({
  marketId,
  initialMarket,
  initialBets,
  initialOddsHistory,
}: MarketDetailClientProps): JSX.Element {
  const { market } = useMarket(marketId);
  const { bets: liveBets } = useMarketBets(marketId);
  const { poolA: livePoolA, poolB: livePoolB } = useMarketEvents(marketId);
  const [justPlaced, setJustPlaced] = useState<Bet[]>([]);
  const [showDispute, setShowDispute] = useState(false);

  // Use live polled data once available, fall back to SSR initial data
  const m = market ?? initialMarket;
  const oddsHistory = initialOddsHistory;

  const polledBets = liveBets.length ? liveBets : initialBets;
  // Show a bet placed this session immediately, ahead of the next bet-list poll
  const bets = [...justPlaced.filter((b) => !polledBets.some((pb) => pb.id === b.id)), ...polledBets];

  // useMarketEvents drives live pool totals; fall back to the polled market until the first event lands
  const poolA = livePoolA ?? BigInt(m.poolA);
  const poolB = livePoolB ?? BigInt(m.poolB);
  const total = poolA + poolB;
  const oddsA = total === BigInt(0) ? 50 : Number((poolA * BigInt(100)) / total);
  const oddsB = 100 - oddsA;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">
          {m.fighterA.name} vs {m.fighterB.name}
        </h1>
        <MarketStatusBadge status={m.status} />
      </div>

      <CountdownTimer
        targetTimestamp={Math.floor(new Date(m.bettingEndsAt).getTime() / 1000)}
        label="Betting closes in"
        expiredLabel="Locked"
      />

      {/* Fighter cards */}
      <div className="flex flex-col md:flex-row gap-4">
        <FighterCard fighter={m.fighterA} side="A" poolAmount={poolA} impliedOdds={oddsA} />
        <FighterCard fighter={m.fighterB} side="B" poolAmount={poolB} impliedOdds={oddsB} />
      </div>

      <OutcomeChart
        poolA={poolA}
        poolB={poolB}
        labelA={m.fighterA.name}
        labelB={m.fighterB.name}
      />

      <MarketOddsChart marketId={marketId} historicalOdds={oddsHistory} />

      <BetForm
        market={m}
        onBetPlaced={(bet) => setJustPlaced((prev) => [bet, ...prev])}
      />

      {/* Bet history */}
      {bets.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Public Bet History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700">
                  <th className="pb-2 text-left pr-4">Address</th>
                  <th className="pb-2 text-left pr-4">Side</th>
                  <th className="pb-2 text-left pr-4">Amount</th>
                  <th className="pb-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => <BetHistoryRow key={bet.id} bet={bet} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispute section */}
      {isInDisputeWindow(m) && !showDispute && (
        <button
          onClick={() => setShowDispute(true)}
          className="w-full rounded-xl border border-amber-500 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          Dispute Result
        </button>
      )}

      {showDispute && (
        <DisputeModal market={m} onDisputed={() => setShowDispute(false)} />
      )}
    </div>
  );
}
