import React, { useEffect, useRef, useState } from 'react';

export function SnakeGame({ onScoreUpdate }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Game configuration
  const GRID_SIZE = 22;
  const CELL_COUNT = 20;

  // Game states referenced in loop using refs to avoid React state lag
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }],
    direction: { x: 0, y: -1 },
    nextDirection: { x: 0, y: -1 },
    food: { x: 5, y: 5 },
    particles: [],
    gameSpeed: 130, // ms
    lastTick: 0,
    score: 0,
  });

  // Helper to change direction cleanly from keyboard or mobile controller
  const changeDirection = (newDir) => {
    if (!hasStarted || gameOver || isPaused) return;
    const dir = stateRef.current.direction;
    // Prevent self collision by making 180 degree turns illegal
    if (newDir.x !== 0 && dir.x === 0) {
      stateRef.current.nextDirection = newDir;
    } else if (newDir.y !== 0 && dir.y === 0) {
      stateRef.current.nextDirection = newDir;
    }
  };

  // Touch Swipe Gesture Refs for Mobile playability
  const touchStartRef = useRef(null);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    
    const threshold = 30; // Minimum sliding distance to trigger swipe action
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) {
        if (dx > 0) {
          changeDirection({ x: 1, y: 0 }); // Swipe right
        } else {
          changeDirection({ x: -1, y: 0 }); // Swipe left
        }
      }
    } else {
      if (Math.abs(dy) > threshold) {
        if (dy > 0) {
          changeDirection({ x: 0, y: 1 }); // Swipe down
        } else {
          changeDirection({ x: 0, y: -1 }); // Swipe up
        }
      }
    }
    touchStartRef.current = null;
  };

  // Load custom high score on mount
  useEffect(() => {
    const saved = localStorage.getItem('snake_highscore');
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
  }, []);

  // Update high score helper
  const updateHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('snake_highscore', newScore.toString());
    }
  };

  // Generate food at random cell (not occupied by snake)
  const spawnFood = (snake) => {
    let newFood;
    let isOnSnake = true;
    while (isOnSnake) {
      newFood = {
        x: Math.floor(Math.random() * CELL_COUNT),
        y: Math.floor(Math.random() * CELL_COUNT),
      };
      isOnSnake = snake.some((part) => part.x === newFood.x && part.y === newFood.y);
    }
    return newFood;
  };

  // Trigger game start / reset
  const startGame = () => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    const initialFood = spawnFood(initialSnake);

    stateRef.current = {
      snake: initialSnake,
      direction: { x: 0, y: -1 },
      nextDirection: { x: 0, y: -1 },
      food: initialFood,
      particles: [],
      gameSpeed: 130,
      lastTick: Date.now(),
      score: 0,
    };

    setScore(0);
    onScoreUpdate(0);
    setGameOver(false);
    setIsPaused(false);
    setHasStarted(true);
  };

  // Move command handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!hasStarted) {
        if (e.key === ' ' || e.key === 'Enter') {
          startGame();
          e.preventDefault();
        }
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        setIsPaused((p) => !p);
        e.preventDefault();
        return;
      }

      const dir = stateRef.current.direction;
      let nextDir = { ...stateRef.current.nextDirection };

      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          if (dir.y === 0) nextDir = { x: 0, y: -1 };
          e.preventDefault();
          break;
        case 'arrowdown':
        case 's':
          if (dir.y === 0) nextDir = { x: 0, y: 1 };
          e.preventDefault();
          break;
        case 'arrowleft':
        case 'a':
          if (dir.x === 0) nextDir = { x: -1, y: 0 };
          e.preventDefault();
          break;
        case 'arrowright':
        case 'd':
          if (dir.x === 0) nextDir = { x: 1, y: 0 };
          e.preventDefault();
          break;
      }

      stateRef.current.nextDirection = nextDir;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, highScore]);

  // Game Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      const state = stateRef.current;
      const now = Date.now();
      const delta = now - state.lastTick;

      // Handle Game tick for calculations (snake positioning)
      if (hasStarted && !gameOver && !isPaused) {
        if (delta >= state.gameSpeed) {
          state.lastTick = now;
          state.direction = { ...state.nextDirection };

          // New head position
          const head = state.snake[0];
          const nextHead = {
            x: head.x + state.direction.x,
            y: head.y + state.direction.y,
          };

          // Collision check: Wall
          if (
            nextHead.x < 0 ||
            nextHead.x >= CELL_COUNT ||
            nextHead.y < 0 ||
            nextHead.y >= CELL_COUNT
          ) {
            setGameOver(true);
            updateHighScore(state.score);
          }

          // Collision check: Self
          if (!gameOver) {
            const selfCollision = state.snake.some(
              (part, i) => i !== 0 && part.x === nextHead.x && part.y === nextHead.y
            );
            if (selfCollision) {
              setGameOver(true);
              updateHighScore(state.score);
            }
          }

          if (!gameOver) {
            // Apply movement (prepend new head)
            const newSnake = [nextHead, ...state.snake];

            // Collision check: Food
            if (nextHead.x === state.food.x && nextHead.y === state.food.y) {
              // Spawn food eat particles
              for (let i = 0; i < 15; i++) {
                state.particles.push({
                  x: state.food.x * GRID_SIZE + GRID_SIZE / 2,
                  y: state.food.y * GRID_SIZE + GRID_SIZE / 2,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  color: 'rgb(244, 63, 94)', // Pink/Neon Red
                  alpha: 1,
                  size: Math.random() * 3 + 2,
                });
              }

              // Update scores
              state.score += 10;
              setScore(state.score);
              onScoreUpdate(state.score);

              // Accelerate game speed slightly
              if (state.gameSpeed > 50) {
                state.gameSpeed = Math.max(50, 130 - Math.floor(state.score / 50) * 8);
              }

              // Spawn new food
              state.food = spawnFood(newSnake);
            } else {
              // Normal move: remove absolute tail
              newSnake.pop();
            }

            state.snake = newSnake;
          }
        }
      }

      // Update particles
      if (state.particles.length > 0) {
        state.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.02;
        });
        state.particles = state.particles.filter((p) => p.alpha > 0);
      }

      // DRAW SECTOR
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background grid outline subtly
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i <= CELL_COUNT; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
      }

      // Draw Glowing Food
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgb(244, 63, 94)'; // Rose neon
      ctx.fillStyle = 'rgb(244, 63, 94)';
      ctx.beginPath();
      const foodX = state.food.x * GRID_SIZE + GRID_SIZE / 2;
      const foodY = state.food.y * GRID_SIZE + GRID_SIZE / 2;
      ctx.arc(foodX, foodY, GRID_SIZE / 2 - 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw glowing Snake
      ctx.shadowColor = 'rgb(34, 197, 94)'; // Lime neon
      state.snake.forEach((part, index) => {
        const isHead = index === 0;
        ctx.fillStyle = isHead ? 'rgb(54, 211, 153)' : 'rgb(34, 197, 94)';
        ctx.shadowBlur = isHead ? 15 : 6;

        ctx.beginPath();
        const px = part.x * GRID_SIZE;
        const py = part.y * GRID_SIZE;
        const radius = isHead ? 6 : 4;
        
        // Draw rounded squares or capsules for snake parts
        ctx.roundRect(px + 2, py + 2, GRID_SIZE - 4, GRID_SIZE - 4, radius);
        ctx.fill();

        // Draw cute snake eyes on head
        if (isHead) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0f172a';
          const eyeSize = 2;
          const leftEyeOffset = 5;
          const rightEyeOffset = GRID_SIZE - 7;
          
          if (state.direction.y !== 0) { // moving up/down
            ctx.fillRect(px + leftEyeOffset, py + 10, eyeSize, eyeSize);
            ctx.fillRect(px + rightEyeOffset, py + 10, eyeSize, eyeSize);
          } else { // moving left/right
            ctx.fillRect(px + 10, py + leftEyeOffset, eyeSize, eyeSize);
            ctx.fillRect(px + 10, py + rightEyeOffset, eyeSize, eyeSize);
          }
        }
      });

      // Draw Particles
      ctx.shadowBlur = 0;
      state.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0; // Reset alpha

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [hasStarted, gameOver, isPaused]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative w-full max-w-[480px] mx-auto select-none" id="snake-container">
      {/* HUD Info */}
      <div className="flex items-center justify-between w-full mb-3 text-sm px-1 font-mono">
        <div className="flex items-center space-x-1.5">
          <span className="text-rose-500">🍎</span>
          <span className="text-slate-300">SCORE:</span>
          <span className="text-white font-bold text-base">{score}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-yellow-400">👑</span>
          <span className="text-slate-300">BEST:</span>
          <span className="text-white font-bold text-base">{highScore}</span>
        </div>
      </div>

      {/* Screen Canvas Area */}
      <div className="relative border-4 border-slate-950 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center w-full max-w-[440px] aspect-square">
        <canvas
          id="snake-canvas"
          ref={canvasRef}
          width={GRID_SIZE * CELL_COUNT}
          height={GRID_SIZE * CELL_COUNT}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="block bg-slate-950 transition-all duration-300 w-full h-auto max-w-[440px] aspect-square touch-none"
        />

        {/* Not started overlay */}
        {!hasStarted && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl animate-pulse mb-4">
              🐍
            </div>
            <h3 className="text-xl font-bold font-sans text-white mb-2 tracking-tight">RETRO SNAKE</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mb-6 font-mono leading-relaxed">
              Use touch gestures (swipe), D-pad below, or WASD keyboard to play.
            </p>
            <button
              id="start-snake-btn"
              onClick={startGame}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-lg border border-emerald-400/20 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all text-sm font-mono tracking-widest cursor-pointer"
            >
              LAUNCH GAME
            </button>
          </div>
        )}

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <h3 className="text-2xl font-black font-sans text-rose-500 mb-1 tracking-wider animate-bounce">
              GAME OVER
            </h3>
            <p className="text-slate-300 font-mono text-xs mb-5">
              FINAL SCORE: <span className="font-bold text-lg text-rose-400">{score}</span>
            </p>
            {score >= highScore && score > 0 && (
              <div className="mb-4 px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded text-yellow-400 text-[10px] font-semibold tracking-wider uppercase font-mono animate-pulse">
                🏆 NEW HIGH SCORE!
              </div>
            )}
            <button
              id="retry-snake-btn"
              onClick={startGame}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-mono font-bold rounded-lg border border-rose-400/25 shadow-lg shadow-rose-950/50 transition-all text-sm tracking-wider cursor-pointer"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Paused Overlay */}
        {isPaused && !gameOver && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
            <span className="text-3xl text-sky-400 mb-2 animate-pulse">⏸</span>
            <h4 className="text-lg font-bold font-mono text-white mb-4 tracking-wider">PAUSED</h4>
            <button
              id="resume-snake-btn"
              onClick={() => setIsPaused(false)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold rounded shadow-md border border-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              RESUME GAME
            </button>
          </div>
        )}
      </div>

      {/* On-Screen Touch D-PAD Controls for Mobiles */}
      {hasStarted && !gameOver && !isPaused && (
        <div className="grid grid-cols-3 gap-2 w-36 mx-auto mt-5" id="mobile-snake-controllers">
          <div />
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); changeDirection({ x: 0, y: -1 }); }}
            onClick={() => changeDirection({ x: 0, y: -1 })}
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 active:bg-cyan-400 active:text-slate-950 text-white font-black rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition-all cursor-pointer select-none text-base touch-none"
          >
            ▲
          </button>
          <div />

          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); changeDirection({ x: -1, y: 0 }); }}
            onClick={() => changeDirection({ x: -1, y: 0 })}
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 active:bg-cyan-400 active:text-slate-950 text-white font-black rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition-all cursor-pointer select-none text-base touch-none"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(true)}
            className="w-11 h-11 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-[9px] font-mono text-slate-500 font-bold tracking-tighter"
          >
            II
          </button>
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); changeDirection({ x: 1, y: 0 }); }}
            onClick={() => changeDirection({ x: 1, y: 0 })}
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 active:bg-cyan-400 active:text-slate-950 text-white font-black rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition-all cursor-pointer select-none text-base touch-none"
          >
            ▶
          </button>

          <div />
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); changeDirection({ x: 0, y: 1 }); }}
            onClick={() => changeDirection({ x: 0, y: 1 })}
            className="w-11 h-11 bg-slate-800 hover:bg-slate-700 active:bg-cyan-400 active:text-slate-950 text-white font-black rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition-all cursor-pointer select-none text-base touch-none"
          >
            ▼
          </button>
          <div />
        </div>
      )}

      {/* Control Instruction Tip */}
      <p className="text-slate-500 text-[10px] uppercase tracking-wide mt-3.5 font-mono text-center">
        Controls: Swipe on game screen, tap arrows, or use W/A/S/D.
      </p>
    </div>
  );
}
