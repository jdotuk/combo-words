'use client';

import { Combo } from '@/lib/types';
import { useState } from 'react';

interface FlashcardProps {
  combo: Combo & { wordIds: string[] };
  onPass: () => void;
  onBack: () => void;
  canGoBack: boolean;
  loading?: boolean;
}

export default function Flashcard({ combo, onPass, onBack, canGoBack, loading = false }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Generate a color from the combo ID for placeholder
  const getColorFromId = (id: string) => {
    const colors = [
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'bg-gradient-to-br from-red-400 to-red-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Card Container */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Image Placeholder */}
        <div 
          className={`aspect-square w-full ${getColorFromId(combo.id)} flex items-center justify-center relative cursor-pointer`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className="text-white text-center p-8">
            <div className="text-6xl mb-4">📸</div>
            {isFlipped && (
              <div className="text-sm opacity-75 font-mono">
                {combo.id}
              </div>
            )}
          </div>
        </div>

        {/* Text Display */}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {combo.display_text}
          </h2>
          <p className="text-sm text-gray-500 font-mono">
            {combo.wordIds.join(', ')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 flex gap-4">
          <button
            onClick={onBack}
            disabled={loading || !canGoBack}
            className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 shadow-md"
          >
            {loading ? '...' : '← Back'}
          </button>
          <button
            onClick={onPass}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 shadow-md"
          >
            {loading ? '...' : 'Next →'}
          </button>
        </div>
      </div>

      {/* Tap to flip hint */}
      <p className="text-center text-sm text-gray-500 mt-4">
        Tap image to see combo ID
      </p>
    </div>
  );
}
