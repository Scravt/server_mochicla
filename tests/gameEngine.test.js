import { describe, it, expect, vi } from 'vitest';
import {
  processPlayerAnswer,
  allPlayersSubmitted,
  prepareNextQuestionPayload,
  prepareResultsPayload
} from '../gameEngine.js';
import { RoomStatus, GameConfig } from '../constants.js';
import { createRoom, addPlayerToRoom } from '../roomManager.js';

describe('gameEngine', () => {
  it('should process player answer correctly (correct answer)', () => {
    const questions = [{ id: 1, text: 'Test Q', correctAnswer: 1 }];
    const { data: room } = createRoom(questions, 'host-socket', 'Admin');
    const player = addPlayerToRoom(room, 'player-socket', 'Player 1');
    
    room.status = RoomStatus.PLAYING;
    room.currentQuestionIndex = 0;
    room.questionStartTime = Date.now() - 5000; // answered after 5 seconds
    room.questionDuration = 20000;

    const result = processPlayerAnswer(room, 'player-socket', 1);

    expect(result).toBeDefined();
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.timeTaken).toBeGreaterThanOrEqual(5000);
    expect(room.submissions.has(player.id)).toBe(true);
  });

  it('should process player answer correctly (incorrect answer)', () => {
    const questions = [{ id: 1, text: 'Test Q', correctAnswer: 1 }];
    const { data: room } = createRoom(questions, 'host-socket', 'Admin');
    const player = addPlayerToRoom(room, 'player-socket', 'Player 1');
    
    room.status = RoomStatus.PLAYING;
    room.currentQuestionIndex = 0;
    room.questionStartTime = Date.now() - 5000;
    room.questionDuration = 20000;

    const result = processPlayerAnswer(room, 'player-socket', 0); // wrong answer

    expect(result).toBeDefined();
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should calculate allPlayersSubmitted correctly', () => {
    const questions = [{ id: 1, text: 'Test Q', correctAnswer: 1 }];
    const { data: room } = createRoom(questions, 'host-socket', 'Admin');
    
    const p1 = addPlayerToRoom(room, 'p1-socket', 'Player 1');
    const p2 = addPlayerToRoom(room, 'p2-socket', 'Player 2');

    room.status = RoomStatus.PLAYING;
    room.currentQuestionIndex = 0;
    room.questionStartTime = Date.now();

    expect(allPlayersSubmitted(room)).toBe(false);

    processPlayerAnswer(room, 'p1-socket', 1);
    expect(allPlayersSubmitted(room)).toBe(false);

    processPlayerAnswer(room, 'p2-socket', 1);
    expect(allPlayersSubmitted(room)).toBe(true);
  });

  it('allPlayersSubmitted should ignore disconnected players', () => {
    const questions = [{ id: 1, text: 'Test Q', correctAnswer: 1 }];
    const { data: room } = createRoom(questions, 'host-socket', 'Admin');
    
    const p1 = addPlayerToRoom(room, 'p1-socket', 'Player 1');
    const p2 = addPlayerToRoom(room, 'p2-socket', 'Player 2');

    room.status = RoomStatus.PLAYING;
    room.currentQuestionIndex = 0;
    room.questionStartTime = Date.now();

    processPlayerAnswer(room, 'p1-socket', 1);
    expect(allPlayersSubmitted(room)).toBe(false);

    // Disconnect p2
    p2.isConnected = false;
    
    // Now it should return true because p1 (connected) has submitted
    expect(allPlayersSubmitted(room)).toBe(true);
  });
});
