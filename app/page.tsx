'use client';

import { Combo } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getNextCard, getStats, markWordAsLearnt, unmarkWordAsLearnt, resetProgress } from './actions';
import Flashcard from '@/components/Flashcard';

interface Stats {
  total: number;
  learnt: number;
  unlearnt: number;
}

export default function Home() {
  const [currentCard, setCurrentCard] = useState<Combo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, learnt: 0, unlearnt: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [cardHistory, setCardHistory] = useState<Array<{
    card: Combo & { wordIds: string[] };
    anchorWord: string;
    anchorCardCount: number;
    wordWasMarkedLearnt?: string; // If a word was marked learnt after this card
    nextCardId?: string; // The card that came after this one
  }>>([]);
  const [forwardCard, setForwardCard] = useState<(Combo & { wordIds: string[] }) | null>(null);
  const [anchorWord, setAnchorWord] = useState<string | undefined>();
  const [anchorCount, setAnchorCount] = useState<number>(0);
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(null);
  const [anchorCardCount, setAnchorCardCount] = useState(0);
  const [maxCardsForAnchor, setMaxCardsForAnchor] = useState(3);
  const [shownCombosForAnchor, setShownCombosForAnchor] = useState<string[]>([]);

  const loadCard = async (lastComboId?: string, lastComboWordIds?: string[]) => {
    setLoading(true);
    try {
      // Check if we need to chain (shown maxCards for current anchor)
      const needNewAnchor = currentAnchor && anchorCardCount >= maxCardsForAnchor;
      
      // Only mark as learnt if it's a base word (has 4+ combos)
      if (needNewAnchor && currentAnchor && maxCardsForAnchor === 3) {
        await markWordAsLearnt(currentAnchor);
      }

      const result = await getNextCard(
        lastComboId, 
        needNewAnchor ? null : currentAnchor, 
        needNewAnchor || false,
        needNewAnchor ? lastComboWordIds : undefined,
        anchorCardCount,
        maxCardsForAnchor,
        needNewAnchor ? [] : shownCombosForAnchor
      );
      
      if (result) {
        setCurrentCard(result.card);
        
        // If this is a new anchor word, reset shown combos
        if (result.anchorWord !== currentAnchor) {
          setCurrentAnchor(result.anchorWord);
          setAnchorCardCount(1);
          setMaxCardsForAnchor(result.maxCardsForAnchor);
          setShownCombosForAnchor([result.card.id]);
        } else {
          setAnchorCardCount(prev => prev + 1);
          setShownCombosForAnchor(prev => [...prev, result.card.id]);
        }
      } else {
        setCurrentCard(null);
      }
      
      // Also load stats
      const newStats = await getStats();
      setStats(newStats);
    } catch (error) {
      console.error('Error loading card:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCard();
  }, []);

  const handlePassClick = async () => {
    if (!currentCard || actionLoading) return;
    
    setActionLoading(true);
    try {
      // If we have a forward card (from going back), use it
      if (forwardCard) {
        setCardHistory(prev => [...prev, {
          card: currentCard as any,
          anchorWord: currentAnchor!,
          anchorCardCount: anchorCardCount,
          nextCardId: forwardCard.id
        }]);
        setCurrentCard(forwardCard);
        setForwardCard(null);
        
        // Update anchor state based on the forward card
        // (The anchor should already be correct from when we went back)
        
        // Refresh stats in case anything changed
        const newStats = await getStats();
        setStats(newStats);
      } else {
        // Normal forward: load a new card
        const lastId = currentCard.id;
        const lastWordIds = (currentCard as any).wordIds || [];
        console.log('handlePassClick - currentCard:', currentCard, 'wordIds:', lastWordIds);
        const wordToMark = (currentAnchor && anchorCardCount >= maxCardsForAnchor) ? currentAnchor : undefined;
        
        // Add current card to history with full state
        setCardHistory(prev => [...prev, {
          card: currentCard as any,
          anchorWord: currentAnchor!,
          anchorCardCount: anchorCardCount,
          wordWasMarkedLearnt: wordToMark
        }]);
        
        await loadCard(lastId, lastWordIds);
      }
    } catch (error) {
      console.error('Error handling pass:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackClick = async () => {
    if (cardHistory.length === 0 || actionLoading) return;
    
    setActionLoading(true);
    try {
      // Store current card as the forward card
      setForwardCard(currentCard as any);
      
      // Pop the last card from history
      const historyEntry = cardHistory[cardHistory.length - 1];
      setCardHistory(prev => prev.slice(0, -1));
      
      // If a word was marked learnt after this card, unmark it
      if (historyEntry.wordWasMarkedLearnt) {
        await unmarkWordAsLearnt(historyEntry.wordWasMarkedLearnt);
      }
      
      // Restore the card and anchor state
      setCurrentCard(historyEntry.card);
      setCurrentAnchor(historyEntry.anchorWord);
      setAnchorCardCount(historyEntry.anchorCardCount);
      
      // Refresh stats
      const newStats = await getStats();
      setStats(newStats);
    } catch (error) {
      console.error('Error going back:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (actionLoading) return;
    
    if (!confirm('Reset all progress? This will mark all words as unlearnt.')) {
      return;
    }
    
    setActionLoading(true);
    try {
      await resetProgress();
      // Clear all state and reload from scratch
      setCardHistory([]);
      setCurrentAnchor(null);
      setAnchorCardCount(0);
      setForwardCard(null);
      setShownCombosForAnchor([]);
      await loadCard();
    } catch (error) {
      console.error('Error resetting progress:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              BigBean
            </h1>
            <div className="flex gap-4 items-center">
              <div className="flex gap-4 text-sm text-gray-600">
                {currentAnchor && (
                  <div className="text-purple-600 font-semibold">
                    Learning: {currentAnchor.split('-')[0]} ({anchorCardCount}/{maxCardsForAnchor})
                  </div>
                )}
                <div>
                  <span className="font-semibold text-blue-600">{stats.unlearnt}</span> to learn
                </div>
                <div>
                  <span className="font-semibold text-green-600">{stats.learnt}</span> learnt
                </div>
                <div>
                  <span className="font-semibold text-gray-600">{stats.total}</span> total
                </div>
              </div>
              <button
                onClick={handleReset}
                disabled={actionLoading}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading card...</p>
            </div>
          </div>
        ) : currentCard ? (
          <Flashcard
            combo={currentCard as any}
            onPass={handlePassClick}
            onBack={handleBackClick}
            canGoBack={cardHistory.length > 0}
            loading={actionLoading}
          />
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              All words learnt!
            </h2>
            <p className="text-gray-600 mb-6">
              You've completed learning all {stats.total} base words. Great job!
            </p>
            <button
              onClick={handleReset}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Start over
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-500">
        <p>Anchored Chaining • Prototype v1.0</p>
      </footer>
    </div>
  );
}
