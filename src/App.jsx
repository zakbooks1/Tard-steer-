/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Gamepad2, 
  Search, 
  Heart, 
  Plus, 
  X, 
  RotateCcw, 
  Maximize2, 
  ChevronLeft, 
  Trash2, 
  Monitor, 
  AlertTriangle, 
  Bookmark, 
  Info,
  ExternalLink,
  Flame,
  Tv
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import defaultGamesList from './games.json';
import { SnakeGame } from './components/SnakeGame';
import { BrickBreakerGame } from './components/BrickBreakerGame';

export default function App() {
  // Merge pre-installed games with user custom unblocked games
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom game list form modal toggle
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Custom game form inputs
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('arcade');
  const [newDesc, setNewDesc] = useState('');
  const [newControls, setNewControls] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [formError, setFormError] = useState('');

  // Local storage bookmarks/recents
  const [favorites, setFavorites] = useState([]);
  const [recentGameIds, setRecentGameIds] = useState([]);
  
  // Theater utilities
  const [isDimmed, setIsDimmed] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // to force reload iframe
  const [nativeScore, setNativeScore] = useState(0);
  const theaterContainerRef = useRef(null);

  // Load baseline on mount
  useEffect(() => {
    // 1. Favorites
    const savedFavs = localStorage.getItem('unblocked_favs');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) { /* silent fail */ }
    }

    // 2. Recent Played List
    const savedRecents = localStorage.getItem('unblocked_recents');
    if (savedRecents) {
      try { setRecentGameIds(JSON.parse(savedRecents)); } catch (e) { /* silent fail */ }
    }

    // 3. Custom user unblocked games
    const savedCustom = localStorage.getItem('unblocked_custom');
    let customList = [];
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        customList = parsed.map(g => ({
          ...g,
          type: 'iframe', // custom games added by URL are always iframe
          isCustom: true
        }));
      } catch (e) { /* silent fail */ }
    }

    // Set combined structure
    setGames([...defaultGamesList, ...customList]);
  }, []);

  // Update Favorites storage helper
  const toggleFavorite = (id, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const updated = favorites.includes(id)
      ? favorites.filter(favId => favId !== id)
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem('unblocked_favs', JSON.stringify(updated));
  };

  // Add recently played helper
  const addToRecentPlay = (id) => {
    const filtered = recentGameIds.filter(gameId => gameId !== id);
    const updated = [id, ...filtered].slice(0, 5); // store up to 5 games max
    setRecentGameIds(updated);
    localStorage.setItem('unblocked_recents', JSON.stringify(updated));
  };

  // Add custom URL game handler
  const handleAddGame = (e) => {
    e.preventDefault();
    setFormError('');

    if (!newTitle.trim()) {
      setFormError('Please enter a valid game title.');
      return;
    }
    if (!newUrl.trim() || !newUrl.startsWith('http')) {
      setFormError('Please enter a valid absolute game URL starting with http:// or https://');
      return;
    }

    const newGameItem = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom unblocked game URL loaded in standard sandboxed view.',
      category: newCategory,
      sourceUrl: newUrl.trim(),
      type: 'iframe',
      controls: newControls.trim() ? newControls.split(',').map(s => s.trim()) : ['Mouse', 'Keyboard'],
      instructions: newInstructions.trim() || 'Load game and play using default browser keys.',
      isCustom: true
    };

    // Update state and persistent localStorage
    const savedCustomRaw = localStorage.getItem('unblocked_custom');
    let currentSaved = [];
    if (savedCustomRaw) {
      try { currentSaved = JSON.parse(savedCustomRaw); } catch (e) { /* fallback reset */ }
    }
    
    const updatedCustoms = [...currentSaved, newGameItem];
    localStorage.setItem('unblocked_custom', JSON.stringify(updatedCustoms));
    
    setGames([...defaultGamesList, ...updatedCustoms]);

    // Reset Form
    setNewTitle('');
    setNewUrl('');
    setNewCategory('arcade');
    setNewDesc('');
    setNewControls('');
    setNewInstructions('');
    setShowAddModal(false);
  };

  // Delete custom game handler
  const handleDeleteCustomGame = (id, e) => {
    e.stopPropagation();
    e.preventDefault();

    const savedCustomRaw = localStorage.getItem('unblocked_custom');
    if (!savedCustomRaw) return;

    try {
      const currentSaved = JSON.parse(savedCustomRaw);
      const updatedCustoms = currentSaved.filter(g => g.id !== id);
      localStorage.setItem('unblocked_custom', JSON.stringify(updatedCustoms));

      // Refresh games list in view
      setGames([...defaultGamesList, ...updatedCustoms]);

      // If active deleted game is selected, close player
      if (selectedGame?.id === id) {
        setSelectedGame(null);
      }
      
      // Remove from favorites also
      if (favorites.includes(id)) {
        setFavorites(favorites.filter(fid => fid !== id));
      }
    } catch (err) { /* silent fail */ }
  };

  // Request native fullscreen for the theater block
  const handleFullscreen = () => {
    if (theaterContainerRef.current) {
      if (theaterContainerRef.current.requestFullscreen) {
        theaterContainerRef.current.requestFullscreen();
      }
    }
  };

  // Quick reload for the active game
  const handleReloadGame = () => {
    setIframeKey(k => k + 1);
    setNativeScore(0);
  };

  // Filter games based on category and search query
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      // 1. Search filter
      const matchesSearch = 
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Category filter
      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'favorites') return favorites.includes(g.id);
      if (selectedCategory === 'custom') return !!g.isCustom;
      return g.category === selectedCategory;
    });
  }, [games, selectedCategory, searchQuery, favorites]);

  // Recents games data list
  const recentGames = useMemo(() => {
    return recentGameIds
      .map(id => games.find(g => g.id === id))
      .filter(g => !!g);
  }, [recentGameIds, games]);

  // Set active game trigger
  const launchGame = (game) => {
    setSelectedGame(game);
    addToRecentPlay(game.id);
    setIsDimmed(false);
    setNativeScore(0);
    // Scroll window smooth to top so the viewer is prominent
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans relative pb-16">
      
      {/* Immersive Dim Background Shield Overlay */}
      {isDimmed && selectedGame && (
        <div 
          onClick={() => setIsDimmed(false)}
          className="fixed inset-0 bg-slate-950/95 z-40 transition-opacity duration-300" 
        />
      )}

      {/* Retro Header Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-400 w-full" />

      {/* Main Container */}
      <div className="max-w-[1240px] mx-auto px-4 md:px-6">
        
        {/* Navigation / Header Brand Line */}
        <header className="py-6 flex flex-col sm:flex-row items-center justify-between border-b border-slate-900 gap-4 mb-8">
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => setSelectedGame(null)}>
            <div className="relative">
              <Gamepad2 className="w-9 h-9 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent uppercase font-sans">
                ARCADE<span className="text-cyan-400 font-mono tracking-normal ml-1">UNBLOCKED</span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-widest font-mono uppercase">
                100% Free HTML5 Retro Hub
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="header-add-game-btn"
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono font-bold tracking-wider text-cyan-400 active:scale-95 transition-all uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Link</span>
            </button>
            <div className="h-6 w-[1px] bg-slate-900 hidden sm:block" />
            <span className="px-2.5 py-1 text-[10px] rounded-full bg-slate-900 text-slate-400 font-mono border border-slate-800">
              {games.length} GAMES RUNNING
            </span>
          </div>
        </header>

        {/* ACTIVE MOUNTED THEATER GAME VIEWER PANEL */}
        <AnimatePresence mode="wait">
          {selectedGame && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -25 }}
              transition={{ duration: 0.3 }}
              className={`relative z-50 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 md:p-6 mb-10 overflow-hidden ${
                isDimmed ? 'ring-2 ring-cyan-500/20' : ''
              }`}
            >
              {/* Retro top corner notches */}
              <div className="absolute top-0 left-0 w-3 h-3 bg-slate-950 border-r border-b border-slate-800 rounded-br-lg" />
              <div className="absolute top-0 right-0 w-3 h-3 bg-slate-950 border-l border-b border-slate-800 rounded-bl-lg" />

              {/* Theater Control Panel Bars */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <button
                    id="exit-theater-btn"
                    onClick={() => {
                      setSelectedGame(null);
                      setIsDimmed(false);
                    }}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800/80 active:scale-95 cursor-pointer"
                    title="Exit Game"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base md:text-lg font-black tracking-tight text-white uppercase">
                        {selectedGame.title}
                      </h2>
                      <span className={`px-2 py-0.5 text-[9px] rounded font-mono uppercase ${
                        selectedGame.type === 'native' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/10'
                      }`}>
                        {selectedGame.type === 'native' ? 'Built-in (Offline safe)' : 'Iframe Embed'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 max-w-[400px]">
                      {selectedGame.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                  {/* Score Indicator if playing built-in native games */}
                  {selectedGame.type === 'native' && (
                    <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
                      Live Score: <span className="text-white text-sm ml-1">{nativeScore}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-1.5 ml-auto md:ml-0">
                    <button
                      id="favorite-theater-toggle"
                      onClick={() => toggleFavorite(selectedGame.id)}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer border ${
                        favorites.includes(selectedGame.id)
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                      title="Bookmark Game"
                    >
                      <Heart className={`w-3.5 h-3.5 ${favorites.includes(selectedGame.id) ? 'fill-rose-400' : ''}`} />
                      <span className="hidden sm:inline">
                        {favorites.includes(selectedGame.id) ? 'FAVORITED' : 'FAVORITE'}
                      </span>
                    </button>

                    <button
                      id="lights-toggle-btn"
                      onClick={() => setIsDimmed(!isDimmed)}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-mono font-bold border tracking-wider transition-colors cursor-pointer ${
                        isDimmed 
                          ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/25' 
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                      title="Dim Site Ambience"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">AMBIENT DIM</span>
                    </button>

                    <button
                      id="reload-theater-btn"
                      onClick={handleReloadGame}
                      className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800 active:scale-95 cursor-pointer"
                      title="Reset / Force Reload Frame"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      id="fullscreen-theater-btn"
                      onClick={handleFullscreen}
                      className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800 active:scale-95 cursor-pointer"
                      title="Request Screen Fullscreen Only"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TWO COLUMN GRID: GAME STAGE + SPECIFIC CONTROLS MANUAL */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Stage Canvas/Iframe Block */}
                <div 
                  ref={theaterContainerRef}
                  className="lg:col-span-3 flex flex-col items-center justify-center bg-slate-950 border border-slate-950 rounded-xl overflow-hidden min-h-[340px] sm:min-h-[460px] p-2 relative shadow-inner"
                >
                  {selectedGame.type === 'native' ? (
                    /* NATIVE REACT BUILT-IN GAMES COMPONENT SLOTS */
                    <div className="w-full h-full flex items-center justify-center py-4">
                      {selectedGame.id === 'snake' && (
                        <SnakeGame key={iframeKey} onScoreUpdate={setNativeScore} />
                      )}
                      {selectedGame.id === 'brick-breaker' && (
                        <BrickBreakerGame key={iframeKey} onScoreUpdate={setNativeScore} />
                      )}
                    </div>
                  ) : (
                    /* IFRAME WRAPPER SECTION FOR WEB LOOPS */
                    <iframe
                      id="unblocked-game-iframe"
                      key={iframeKey}
                      src={selectedGame.sourceUrl}
                      title={selectedGame.title}
                      className="w-full h-[320px] sm:h-[400px] md:h-[480px] border-0 rounded-lg shadow-2xl bg-black"
                      allow="fullscreen; autoplay; gamepad; keyboard"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {/* GAME CONTROL MANUALS & STATS COLUMN */}
                <div className="flex flex-col space-y-4">
                  
                  {/* Controls HUD */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider mb-3 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>CONTROL COMBOS</span>
                    </h3>
                    <ul className="space-y-2">
                      {selectedGame.controls.map((ctrl, i) => (
                        <li key={i} className="flex items-center space-x-2 text-xs bg-slate-900/50 p-2 border border-slate-900 rounded font-mono">
                          <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-100 rounded text-[10px] border-b border-slate-600">
                            Key
                          </kbd>
                          <span className="text-slate-300 font-semibold">{ctrl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Manual Instructions Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase text-rose-500 tracking-wider mb-2 flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-rose-500" />
                        <span>INSTRUCTIONS</span>
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        {selectedGame.instructions}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                        <Monitor className="w-3.5 h-3.5 text-slate-500" />
                        <span>Best played in standard Chrome or Firefox browser.</span>
                      </div>
                      
                      {selectedGame.isCustom && (
                        <div className="mt-3.5 block">
                          <button
                            id="delete-custom-in-player-btn"
                            onClick={(e) => {
                              if (confirm('Are you absolutely sure you want to delete this custom game?')) {
                                handleDeleteCustomGame(selectedGame.id, e);
                              }
                            }}
                            className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 text-[10px] font-mono hover:underline uppercase transition-all duration-150 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete this game</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SIDE BAR / TOP DASHBOARD MODULES */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* LEFT SIDEBAR: RECENTS & FILTER UTILITIES */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Filter Game Category Tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
              <h3 className="text-xs font-mono font-black uppercase text-slate-400 tracking-widest mb-3 pb-2 border-b border-slate-800">
                ARCADE MENU
              </h3>
              
              <nav className="flex flex-col space-y-1">
                {['all', 'arcade', 'puzzle', 'action', 'retro', 'favorites', 'custom'].map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      id={`tab-cat-${cat}`}
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-left transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-cyan-500/10 text-cyan-400 font-bold border-l-4 border-cyan-400 pl-2' 
                          : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <span className="capitalize">{cat}</span>
                      <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-500">
                        {cat === 'all' && games.length}
                        {cat === 'favorites' && favorites.length}
                        {cat === 'custom' && games.filter(g => g.isCustom).length}
                        {cat !== 'all' && cat !== 'favorites' && cat !== 'custom' && games.filter(g => g.category === cat).length}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Recently Played Logs */}
            {recentGames.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-mono font-black uppercase text-slate-400 tracking-widest mb-3 pb-2 border-b border-slate-800 flex items-center justify-between">
                  <span>LAST ACTIVE</span>
                  <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                </h3>
                
                <div className="space-y-2.5">
                  {recentGames.map((rg) => (
                    <div 
                      key={rg.id}
                      onClick={() => launchGame(rg)}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800/80 border border-transparent hover:border-slate-800 cursor-pointer transition-all duration-200"
                    >
                      {rg.thumbnailUrl ? (
                        <img 
                          src={rg.thumbnailUrl} 
                          alt={rg.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-cover rounded-md border border-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 object-cover rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-semibold text-cyan-400">
                          🕹️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide truncate">
                          {rg.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          {rg.category}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Resource Safe Tip Info box */}
            <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-4 text-xs space-y-2 text-slate-400 leading-relaxed font-sans">
              <div className="flex items-center space-x-2 text-yellow-500">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-mono font-black text-[10px] uppercase tracking-wider">Firewall Warning</span>
              </div>
              <p>
                Some schools/offices block external iframe links. If standard games like Flappy Bird do not load, use our pre-optimized, offline-safe **Retro Snake** or **Neon Brick Breaker** games built natively 100% locally!
              </p>
            </div>

          </div>

          {/* MAIN COLUMN RIGHT: SEARCH & GAMES GRID CARDS */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* SEARCH PANEL GRID HEADER BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="game-search-input"
                  type="text"
                  placeholder="Find your retro fav..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 py-2 pl-9 pr-4 rounded-xl text-xs font-mono tracking-wide placeholder:text-slate-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                  Filter Category:
                </span>
                <span className="text-xs font-bold font-mono text-white px-2 py-1 bg-slate-950 rounded border border-slate-800 uppercase tracking-widest text-[10px]">
                  {selectedCategory}
                </span>
              </div>
            </div>

            {/* RESULTS GAME GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" id="games-grid">
              <AnimatePresence>
                {filteredGames.length > 0 ? (
                  filteredGames.map((g, idx) => {
                    const isFav = favorites.includes(g.id);
                    return (
                      <motion.div
                        id={`game-card-${g.id}`}
                        key={g.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.4), duration: 0.2 }}
                        onClick={() => launchGame(g)}
                        className={`group relative flex flex-col justify-between bg-slate-900 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 rounded-2xl overflow-hidden cursor-pointer shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
                          selectedGame?.id === g.id ? 'ring-2 ring-cyan-500/60' : ''
                        }`}
                      >
                        {/* Quick action: Favourite float pill */}
                        <button
                          id={`game-fav-btn-${g.id}`}
                          onClick={(e) => toggleFavorite(g.id, e)}
                          className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                          title="Bookmark Game"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>

                        {/* Top banner / cover area */}
                        <div className="relative aspect-video bg-slate-950 overflow-hidden w-full">
                          {g.thumbnailUrl ? (
                            <img
                              src={g.thumbnailUrl}
                              alt={g.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-slate-900 to-slate-950 text-cyan-400 p-4">
                              <Gamepad2 className="w-8 h-8 opacity-40 mb-2 animate-pulse" />
                              <span className="text-[10px] tracking-widest font-mono uppercase text-slate-500">
                                CUSTOM LINK
                              </span>
                            </div>
                          )}
                          
                          {/* Built-in Indicator on the top banner */}
                          {g.type === 'native' && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-emerald-500 text-slate-950 border border-emerald-400/20 shadow">
                              Offline Safe
                            </span>
                          )}
                          {g.isCustom && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-indigo-500 text-white border border-indigo-400/20 shadow">
                              Custom Link
                            </span>
                          )}
                        </div>

                        {/* Middle Text / Contents */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div className="mb-3">
                            <div className="flex items-center space-x-1 mb-1">
                              <span className="text-[9px] font-mono font-black uppercase tracking-wider text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/30 border border-cyan-900/10">
                                {g.category}
                              </span>
                            </div>
                            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wide group-hover:text-cyan-400 transition-colors">
                              {g.title}
                            </h3>
                            <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-2 leading-relaxed">
                              {g.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-850 pt-3 mt-1">
                            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">
                              Run Mode: {g.type}
                            </span>
                            
                            {g.isCustom ? (
                              <button
                                id={`delete-custom-card-btn-${g.id}`}
                                onClick={(e) => {
                                  if (confirm('Delete this game from your system?')) {
                                    handleDeleteCustomGame(g.id, e);
                                  }
                                }}
                                className="text-rose-400 hover:text-rose-300 font-mono text-[10px] flex items-center space-x-1 py-1 hover:underline cursor-pointer"
                                title="Remove Custom Link"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            ) : (
                              <span className="text-cyan-400 group-hover:underline text-[10px] font-mono uppercase tracking-wider font-semibold">
                                Launch Game →
                              </span>
                            )}
                          </div>
                        </div>

                      </motion.div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-900 rounded-2xl bg-slate-900/20">
                    <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-4">
                      🕹️
                    </div>
                    <h3 className="text-base font-bold text-slate-300 mb-1">No Games Found</h3>
                    <p className="text-xs text-slate-500 font-sans max-w-[280px] mx-auto">
                      {searchQuery ? `We couldn't matching any unblocked titles for "${searchQuery}".` : 'This specific catalog is currently blank.'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 px-4 py-1.5 bg-slate-900 hover:bg-slate-805 text-cyan-400 border border-slate-800 hover:border-cyan-500/20 text-xs rounded-lg font-mono active:scale-95 transition-all cursor-pointer"
                      >
                        Clear Search Filter
                      </button>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* CREATE GAME PRE-ADD FORM POPUP DIALOG */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal frame container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 relative overflow-hidden shadow-2xl z-20"
            >
              {/* Corner Close button */}
              <button
                id="close-modal-btn"
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-2.5 mb-5 pb-2 border-b border-slate-850">
                <Bookmark className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black font-sans uppercase tracking-tight text-white">
                  ADD CUSTOM GAME LINK
                </h3>
              </div>

              <form onSubmit={handleAddGame} className="space-y-4">
                {formError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-mono leading-normal flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                    Game Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="add-game-title"
                    type="text"
                    required
                    placeholder="e.g. Chrome Dino T-Rex"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                    Direct Embed URL (IFrame Source) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="add-game-url"
                    type="url"
                    required
                    placeholder="https://example.github.io/game/"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block leading-tight">
                    Must start with <code className="text-slate-400 font-mono">https://</code>. Ensure host supports iframe embeds.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                      Tab Category
                    </label>
                    <select
                      id="add-game-category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
                    >
                      <option value="arcade">Arcade</option>
                      <option value="puzzle">Puzzle</option>
                      <option value="action">Action</option>
                      <option value="retro">Retro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                      Inputs / Keys (comma sep)
                    </label>
                    <input
                      id="add-game-controls"
                      type="text"
                      placeholder="Arrows, Space, Mouse"
                      value={newControls}
                      onChange={(e) => setNewControls(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                    Short Description
                  </label>
                  <textarea
                    id="add-game-description"
                    placeholder="Brief summary of gameplay style..."
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 tracking-wide mb-1">
                    Instruction Manual
                  </label>
                  <textarea
                    id="add-game-instructions"
                    placeholder="Step by step keys, hints, guidelines..."
                    rows={2}
                    value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-3">
                  <button
                    id="cancel-add-btn"
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-add-btn"
                    type="submit"
                    className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs rounded-lg active:scale-95 transition-all cursor-pointer"
                  >
                    Save Launcher Link
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Retro Footer line */}
      <footer className="mt-16 border-t border-slate-900 pt-8 text-center text-xs font-mono text-slate-500">
        <div className="max-w-[1240px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Arcade Unblocked Hub. Handcrafted local browser storage games wrapper.</p>
          <div className="flex space-x-4">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
              No Ads • No Distractions • Unblocked Pure Fun
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
