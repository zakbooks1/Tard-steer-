import React, { useEffect, useRef, useState } from 'react';

export function BrickBreakerGame({ onScoreUpdate }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('brick_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [win, setWin] = useState(false);

  // Dimensions
  const WIDTH = 440;
  const HEIGHT = 400;

  // Game variable refs to run in loop safely
  const varsRef = useRef({
    score: 0,
    level: 1,
    paddleX: WIDTH / 2 - 40,
    paddleWidth: 80,
    paddleHeight: 10,
    ballX: WIDTH / 2,
    ballY: HEIGHT - 30,
    ballVx: 3,
    ballVy: -3,
    ballRadius: 6,
    bricks: [],
    particles: [],
    isPaddleMovingLeft: false,
    isPaddleMovingRight: false,
    mousePos: WIDTH / 2,
    isPlaying: false,
  });

  // Calculate highscore
  const updateHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('brick_highscore', newScore.toString());
    }
  };

  // Populate blocks
  const generateBricks = (lvl) => {
    const BRICK_ROWS = Math.min(6, 3 + lvl);
    const BRICK_COLS = 8;
    const BRICK_WIDTH = 46;
    const BRICK_HEIGHT = 16;
    const BRICK_PADDING_X = 6;
    const BRICK_PADDING_Y = 6;
    const OFFSET_TOP = 40;
    const OFFSET_LEFT = (WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING_X) - BRICK_PADDING_X)) / 2;

    const list = [];
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        // Durability: rows higher up are tougher
        const rowPercentage = r / BRICK_ROWS;
        let durability = 1;
        if (rowPercentage < 0.3) {
          durability = 3;
        } else if (rowPercentage < 0.6) {
          durability = 2;
        }

        let colIndex = r % colors.length;
        if (durability === 3) colIndex = 0; // Rose
        else if (durability === 2) colIndex = 3; // Yellow
        else colIndex = 2; // Emerald

        list.push({
          x: OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING_X),
          y: OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING_Y),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          durability,
          color: colors[colIndex],
          active: true,
        });
      }
    }
    return list;
  };

  // Launch / Reset
  const startGame = () => {
    varsRef.current = {
      score: 0,
      level: 1,
      paddleX: WIDTH / 2 - 40,
      paddleWidth: 80,
      paddleHeight: 10,
      ballX: WIDTH / 2,
      ballY: HEIGHT - 35,
      // Launch velocity
      ballVx: (Math.random() - 0.5) * 3 || 1.5,
      ballVy: -4.5,
      ballRadius: 6,
      bricks: generateBricks(1),
      particles: [],
      isPaddleMovingLeft: false,
      isPaddleMovingRight: false,
      mousePos: WIDTH / 2,
      isPlaying: true,
    };

    setScore(0);
    setLevel(1);
    onScoreUpdate(0);
    setGameOver(false);
    setWin(false);
    setIsPaused(false);
    setHasStarted(true);
  };

  // Progress to next level helper
  const nextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    
    const speedMultiplier = 1.0 + (nextLvl * 0.12);
    varsRef.current.level = nextLvl;
    varsRef.current.bricks = generateBricks(nextLvl);
    varsRef.current.paddleX = WIDTH / 2 - 35; // slightly shrink paddle for challenge
    varsRef.current.paddleWidth = Math.max(50, 80 - nextLvl * 3);
    varsRef.current.ballX = WIDTH / 2;
    varsRef.current.ballY = HEIGHT - 35;
    varsRef.current.ballVx = ((Math.random() - 0.5) * 3 || 1.5) * speedMultiplier;
    varsRef.current.ballVy = -4.5 * speedMultiplier;
    varsRef.current.isPlaying = true;
    
    setWin(false);
    setIsPaused(false);
  };

  // Touch pad controllers steering indicators
  const setPaddleMoveLeft = (isMoving) => {
    varsRef.current.isPaddleMovingLeft = isMoving;
  };

  const setPaddleMoveRight = (isMoving) => {
    varsRef.current.isPaddleMovingRight = isMoving;
  };

  // Handlers for keyboards
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

      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        varsRef.current.isPaddleMovingLeft = true;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        varsRef.current.isPaddleMovingRight = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        varsRef.current.isPaddleMovingLeft = false;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        varsRef.current.isPaddleMovingRight = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasStarted, level, highScore]);

  // Handle Mouse / Touch controller
  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    varsRef.current.paddleX = Math.max(0, Math.min(WIDTH - varsRef.current.paddleWidth, x - varsRef.current.paddleWidth / 2));
  };

  const handleTouchMove = (e) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    varsRef.current.paddleX = Math.max(0, Math.min(WIDTH - varsRef.current.paddleWidth, x - varsRef.current.paddleWidth / 2));
    e.preventDefault();
  };

  // Rendering Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const v = varsRef.current;

      // Update positions
      if (hasStarted && !gameOver && !isPaused && !win) {
        // Move Paddle by keyboard
        const SPEED = 5;
        if (v.isPaddleMovingLeft) {
          v.paddleX = Math.max(0, v.paddleX - SPEED);
        }
        if (v.isPaddleMovingRight) {
          v.paddleX = Math.min(WIDTH - v.paddleWidth, v.paddleX + SPEED);
        }

        // Move Ball
        v.ballX += v.ballVx;
        v.ballY += v.ballVy;

        // Collision: Outer Walls
        if (v.ballX - v.ballRadius <= 0) {
          v.ballX = v.ballRadius;
          v.ballVx = -v.ballVx;
        } else if (v.ballX + v.ballRadius >= WIDTH) {
          v.ballX = WIDTH - v.ballRadius;
          v.ballVx = -v.ballVx;
        }

        if (v.ballY - v.ballRadius <= 0) {
          v.ballY = v.ballRadius;
          v.ballVy = -v.ballVy;
        }

        // Game Over: Bottom wall
        if (v.ballY + v.ballRadius >= HEIGHT) {
          setGameOver(true);
          v.isPlaying = false;
          updateHighScore(v.score);
        }

        // Collision: Paddle
        if (
          v.ballY + v.ballRadius >= HEIGHT - 20 - v.paddleHeight / 2 &&
          v.ballY - v.ballRadius <= HEIGHT - 20 + v.paddleHeight / 2 &&
          v.ballX >= v.paddleX &&
          v.ballX <= v.paddleX + v.paddleWidth
        ) {
          // Calculate bounce angle based on hitting position
          const hitPoint = (v.ballX - (v.paddleX + v.paddleWidth / 2)) / (v.paddleWidth / 2);
          const currentSpeed = Math.sqrt(v.ballVx * v.ballVx + v.ballVy * v.ballVy);
          
          // Re-route velocity
          v.ballVx = hitPoint * (currentSpeed * 0.85);
          v.ballVy = -Math.max(1.8, Math.sqrt(Math.max(4, currentSpeed * currentSpeed - v.ballVx * v.ballVx)));
          v.ballY = HEIGHT - 20 - v.paddleHeight / 2 - v.ballRadius; // reset safely above paddle
        }

        // Collision: Bricks
        let allCleared = true;
        for (let i = 0; i < v.bricks.length; i++) {
          const b = v.bricks[i];
          if (!b.active) continue;
          allCleared = false;

          // Ball boundaries
          const ballLeft = v.ballX - v.ballRadius;
          const ballRight = v.ballX + v.ballRadius;
          const ballTop = v.ballY - v.ballRadius;
          const ballBottom = v.ballY + v.ballRadius;

          // Inside brick boundary check
          if (
            ballRight >= b.x &&
            ballLeft <= b.x + b.width &&
            ballBottom >= b.y &&
            ballTop <= b.y + b.height
          ) {
            // Collision logic: determine side of collision
            const distLeft = Math.abs(ballRight - b.x);
            const distRight = Math.abs(ballLeft - (b.x + b.width));
            const distTop = Math.abs(ballBottom - b.y);
            const distBottom = Math.abs(ballTop - (b.y + b.height));

            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            if (minDist === distLeft || minDist === distRight) {
              v.ballVx = -v.ballVx;
            } else {
              v.ballVy = -v.ballVy;
            }

            // Hit brick durability
            b.durability -= 1;
            if (b.durability <= 0) {
              b.active = false;
              v.score += 20;

              // Spawn vibrant glow breakdown particles
              for (let p = 0; p < 12; p++) {
                v.particles.push({
                  x: b.x + b.width / 2,
                  y: b.y + b.height / 2,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  color: b.color,
                  alpha: 1.0,
                  size: Math.random() * 2.5 + 1.5,
                });
              }
            } else {
              // Brick cracked - glowing flash particles
              v.score += 5;
              for (let p = 0; p < 4; p++) {
                v.particles.push({
                  x: v.ballX,
                  y: v.ballY,
                  vx: (Math.random() - 0.5) * 3,
                  vy: -Math.random() * 3,
                  color: '#ffffff',
                  alpha: 0.8,
                  size: Math.random() * 1.5 + 1,
                });
              }
            }

            setScore(v.score);
            onScoreUpdate(v.score);
            break; // only test one brick hit per tick
          }
        }

        if (allCleared && v.bricks.length > 0) {
          setWin(true);
        }
      }

      // Update exploding break particles
      if (v.particles.length > 0) {
        v.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
        });
        v.particles = v.particles.filter((p) => p.alpha > 0);
      }

      // DRAW SECTION
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Subtle boundary line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, WIDTH, HEIGHT);

      // Draw active blocks
      v.bricks.forEach((b) => {
        if (!b.active) return;
        
        ctx.fillStyle = b.color;
        
        // Dynamic opacity or look based on durability
        if (b.durability === 3) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
        } else if (b.durability === 2) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1;
        }

        ctx.shadowBlur = b.durability >= 2 ? 8 : 4;
        ctx.shadowColor = b.color;

        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 3);
        ctx.fill();
        ctx.stroke();
      });

      // Draw Ball
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#06b6d4'; // cyan neon ball
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(v.ballX, v.ballY, v.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw Paddle
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#a855f7'; // Purple neon
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.roundRect(v.paddleX, HEIGHT - 20 - v.paddleHeight / 2, v.paddleWidth, v.paddleHeight, 4);
      ctx.fill();

      // Draw Active Particles
      ctx.shadowBlur = 0;
      v.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0; // Reset canvas values

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [hasStarted, gameOver, win, isPaused, level]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative w-full max-w-[480px] mx-auto select-none" id="bricks-container" ref={containerRef}>
      {/* Heads Up Grid */}
      <div className="flex items-center justify-between w-full mb-3 text-sm px-1 font-mono">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span className="text-cyan-400">⚡</span>
            <span className="text-slate-300 text-xs">LVL:</span>
            <span className="text-white font-black">{level}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-slate-300 text-xs">SCORE:</span>
            <span className="text-white font-black">{score}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-yellow-400">👑</span>
          <span className="text-slate-300 text-xs">BEST:</span>
          <span className="text-white font-black text-sm">{highScore}</span>
        </div>
      </div>

      {/* Screen Area */}
      <div className="relative border-4 border-slate-950 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center w-full max-w-[440px] aspect-[11/10]">
        <canvas
          id="brickbreaker-canvas"
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="block bg-slate-950 transition-all duration-300 w-full h-auto max-w-[440px] aspect-[11/10] touch-none"
        />

        {/* Start Game View */}
        {!hasStarted && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 text-3xl animate-pulse mb-4">
              ⚔️
            </div>
            <h3 className="text-xl font-bold font-sans text-white mb-2 tracking-tight">NEON BRICK BREAKER</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mb-6 font-mono leading-relaxed">
              Drag on screen, tap the steering keys below, or use keyboard arrows/AD.
            </p>
            <button
              id="start-brick-btn"
              onClick={startGame}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white font-bold rounded-lg border border-violet-400/20 shadow-lg shadow-violet-950/40 active:scale-95 transition-all text-sm font-mono tracking-widest cursor-pointer"
            >
              LAUNCH GAME
            </button>
          </div>
        )}

        {/* Level Complete / Win Game View */}
        {win && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <span className="text-4xl text-yellow-400 animate-bounce mb-3">💥 GRAND SUCCESS! 💥</span>
            <h3 className="text-lg font-black font-mono text-emerald-400 mb-2">
              STAGE {level} CLEAR!
            </h3>
            <p className="text-slate-300 text-xs font-mono max-w-[280px] mb-6">
               Ready for the next stage? Speed will be elevated.
            </p>
            <button
              id="next-level-btn"
              onClick={nextLevel}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-mono font-black rounded-lg border border-emerald-400/35 shadow-lg shadow-emerald-950/50 transition-all text-sm tracking-wider cursor-pointer"
            >
              START STAGE {level + 1}
            </button>
          </div>
        )}

        {/* GameOver View */}
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
                🏆 NEW HIGHSCORE REACHED!
              </div>
            )}
            <button
              id="retry-brick-btn"
              onClick={startGame}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-mono font-bold rounded-lg border border-rose-400/25 shadow-lg shadow-rose-950/50 transition-all text-sm tracking-wider cursor-pointer"
            >
              LAUNCH REBOOT
            </button>
          </div>
        )}

        {/* Paused View */}
        {isPaused && !gameOver && !win && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
            <span className="text-3xl text-violet-400 mb-2 animate-pulse">⏸</span>
            <h4 className="text-lg font-bold font-mono text-white mb-4 tracking-wider">PAUSED</h4>
            <button
              id="resume-brick-btn"
              onClick={() => setIsPaused(false)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold rounded shadow-md border border-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              RESUME GAME
            </button>
          </div>
        )}
      </div>

      {/* On-screen Directional Controllers */}
      {hasStarted && !gameOver && !win && !isPaused && (
        <div className="flex items-center justify-between w-full max-w-[320px] mt-4 px-2" id="brickbreaker-mobile-controls">
          <button
            type="button"
            onMouseDown={() => setPaddleMoveLeft(true)}
            onMouseUp={() => setPaddleMoveLeft(false)}
            onMouseLeave={() => setPaddleMoveLeft(false)}
            onTouchStart={(e) => { e.preventDefault(); setPaddleMoveLeft(true); }}
            onTouchEnd={(e) => { e.preventDefault(); setPaddleMoveLeft(false); }}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-750 active:bg-violet-500 active:text-slate-950 border border-slate-700 text-white font-black rounded-xl shadow-lg transition-all text-base touch-none select-none cursor-pointer"
          >
            ◀ STEER LEFT
          </button>

          <button
            type="button"
            onClick={() => setIsPaused(true)}
            className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs hover:text-white"
          >
            II
          </button>

          <button
            type="button"
            onMouseDown={() => setPaddleMoveRight(true)}
            onMouseUp={() => setPaddleMoveRight(false)}
            onMouseLeave={() => setPaddleMoveRight(false)}
            onTouchStart={(e) => { e.preventDefault(); setPaddleMoveRight(true); }}
            onTouchEnd={(e) => { e.preventDefault(); setPaddleMoveRight(false); }}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-750 active:bg-violet-500 active:text-slate-950 border border-slate-700 text-white font-black rounded-xl shadow-lg transition-all text-base touch-none select-none cursor-pointer"
          >
            STEER RIGHT ▶
          </button>
        </div>
      )}

      {/* Control Manual */}
      <p className="text-slate-500 text-[10px] uppercase tracking-wide mt-3.5 font-mono text-center">
        Controls: Drag on game screen, hold visual buttons, or use Arrow keys.
      </p>
    </div>
  );
}
