import React, { useState, useEffect } from 'react';
import { GameBoard } from './GameBoard';
import PlayerTurnIndicator from './PlayerTurnIndicator';
import PlayerStats from './PlayerStats';
import { GameState, Player } from '../types/GameTypes';
import { createInitialState, makeMove, undoMove, redoMove } from '../utils/gameLogic';
import { createInitialStats, updatePlayerStats } from '../utils/statsManager';
import { WinProbabilityTracker } from '../utils/winProbability';
import WinProbabilityGraph from './WinProbabilityGraph';
import storageService from '../services/storageService';
import '../styles/animations.css';

const Game: React.FC = () => {
    const [players, setPlayers] = useState<[Player, Player]>(() => [
        { id: '1', name: 'Player 1', type: 'human', symbol: 1, stats: createInitialStats() },
        { id: '2', name: 'Player 2', type: 'human', symbol: 2, stats: createInitialStats() }
    ]);

    const [gameState, setGameState] = useState<GameState>(() => ({
        ...createInitialState(1, players),
        sessionStats: {
            totalGames: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now()
        }
    }));

    const [probabilityTracker] = useState(() => new WinProbabilityTracker(1));

    useEffect(() => {
        const loadPlayerStats = async () => {
            try {
                const player1Stats = await storageService.getPlayerStats(players[0].name);
                const player2Stats = await storageService.getPlayerStats(players[1].name);

                setPlayers(prevPlayers => [
                    { ...prevPlayers[0], stats: player1Stats || createInitialStats() },
                    { ...prevPlayers[1], stats: player2Stats || createInitialStats() }
                ]);
            } catch (error) {
                console.error('Error loading player stats:', error);
            }
        };

        loadPlayerStats();
    }, []);

    useEffect(() => {
        const flatBoard = gameState.board.flat();
        probabilityTracker.updateProbability(flatBoard);
    }, [gameState.board]);

    const updateStats = async (newGameState: GameState) => {
        if (newGameState.gameStatus === 'won' || newGameState.gameStatus === 'draw') {
            const updatedPlayers = players.map(player => ({
                ...player,
                stats: updatePlayerStats(
                    player.stats,
                    newGameState,
                    newGameState.moveHistory.length,
                    player.symbol
                )
            }));

            setPlayers(updatedPlayers as [Player, Player]);

            try {
                await Promise.all([
                    storageService.savePlayerStats(updatedPlayers[0].name, updatedPlayers[0].stats),
                    storageService.savePlayerStats(updatedPlayers[1].name, updatedPlayers[1].stats)
                ]);
            } catch (error) {
                console.error('Error saving player stats:', error);
            }
        }
    };

    const handleCellClick = (row: number, col: number) => {
        setGameState(prevState => {
            const newState = makeMove(prevState, row, col);
            updateStats(newState);
            return newState;
        });
    };

    const handleMove = (position: number) => {
        const row = Math.floor(position / 3);
        const col = position % 3;
        setGameState(prevState => {
            const newState = makeMove(prevState, row, col);
            updateStats(newState);
            return newState;
        });
    };

    const handleUndo = () => {
        setGameState(prevState => undoMove(prevState));
    };

    const handleRedo = () => {
        setGameState(prevState => redoMove(prevState));
    };

    const handleNewGame = () => {
        setGameState(prevState => ({
            ...createInitialState(1, players),
            sessionStats: {
                ...prevState.sessionStats,
                totalGames: prevState.sessionStats.totalGames + 1,
                lastUpdateTime: Date.now()
            }
        }));
        probabilityTracker.reset();
    };

    const handlePlayerNameChange = async (index: number, newName: string) => {
        try {
            const existingStats = await storageService.getPlayerStats(newName);
            
            setPlayers(prevPlayers => {
                const updatedPlayers = [...prevPlayers] as [Player, Player];
                updatedPlayers[index] = {
                    ...updatedPlayers[index],
                    name: newName,
                    stats: existingStats || createInitialStats()
                };
                return updatedPlayers;
            });
        } catch (error) {
            console.error('Error updating player name:', error);
        }
    };

    return (
        <div className="app">
            <h1>Tic Tac Toe</h1>

            {storageService.isInOfflineMode() && (
                <div style={{
                    backgroundColor: 'rgba(255, 71, 87, 0.2)',
                    color: '#ff4757',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontFamily: 'monospace',
                    border: '1px solid #ff4757'
                }}>
                    🔄 Offline Mode - Stats will be saved locally
                </div>
            )}

            <div className="game-container">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    alignItems: 'center',
                }}>
                    <PlayerTurnIndicator
                        currentPlayer={gameState.currentPlayer}
                        players={players}
                    />

                    <div className="game-board-container">
                        <GameBoard
                            gameState={gameState}
                            onCellClick={handleCellClick}
                            lastMove={gameState.moveHistory.length > 0 
                                ? { 
                                    row: gameState.moveHistory[gameState.moveHistory.length - 1].position[0],
                                    col: gameState.moveHistory[gameState.moveHistory.length - 1].position[1]
                                  }
                                : undefined}
                        />
                    </div>

                    <div className="game-controls">
                        <button
                            className="button-hover"
                            onClick={handleUndo}
                            disabled={gameState.moveHistory.length === 0 || gameState.gameStatus !== 'playing'}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'transparent',
                                color: '#00ff00',
                                border: '1px solid #00ff00',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontFamily: 'monospace'
                            }}
                        >
                            Undo
                        </button>

                        <button
                            className="button-hover"
                            onClick={handleRedo}
                            disabled={gameState.undoStack.length === 0 || gameState.gameStatus !== 'playing'}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'transparent',
                                color: '#00ff00',
                                border: '1px solid #00ff00',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontFamily: 'monospace'
                            }}
                        >
                            Redo
                        </button>

                        <button
                            className="button-hover"
                            onClick={handleNewGame}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'transparent',
                                color: '#00ff00',
                                border: '1px solid #00ff00',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontFamily: 'monospace'
                            }}
                        >
                            New Game
                        </button>
                    </div>
                </div>
            </div>

            <div className="player-stats-container" style={{
                display: 'flex',
                justifyContent: 'space-around',
                width: '100%',
                marginTop: '20px',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <PlayerStats 
                    player={players[0]} 
                    onNameChange={(name) => handlePlayerNameChange(0, name)}
                />
                <PlayerStats 
                    player={players[1]} 
                    onNameChange={(name) => handlePlayerNameChange(1, name)}
                />
            </div>

            <div className="probability-container" style={{
                width: '100%',
                maxWidth: '600px',
                margin: '15px auto'
            }}>
                <WinProbabilityGraph
                    probabilities={probabilityTracker.getProbabilityHistory()}
                    currentMove={probabilityTracker.getCurrentMove()}
                />
            </div>
        </div>
    );
};

export default Game;
