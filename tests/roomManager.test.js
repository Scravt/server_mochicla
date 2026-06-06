import { describe, it, expect, vi } from 'vitest';
import {
  createRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  getNonHostPlayers,
  cleanupRoom
} from '../roomManager.js';
import { RoomStatus } from '../constants.js';

describe('roomManager', () => {
  it('should create a room with the correct initial state', () => {
    const questions = [{ id: 1, text: 'Test Q' }];
    const hostId = 'socket-123';
    const hostName = 'Host Admin';

    const { code, data } = createRoom(questions, hostId, hostName);

    expect(code).toBeDefined();
    expect(code.length).toBe(6);
    expect(data.status).toBe(RoomStatus.LOBBY);
    expect(data.questions).toBe(questions);
    expect(data.players.length).toBe(1);
    
    const host = data.players[0];
    expect(host.socketId).toBe(hostId);
    expect(host.name).toBe(hostName);
    expect(host.isHost).toBe(true);
    expect(host.isConnected).toBe(true);
  });

  it('should add a player to a room', () => {
    const { data: room } = createRoom([], 'host-socket', 'Admin');
    const playerSocketId = 'player-socket-456';
    const playerName = 'Player 1';

    const newPlayer = addPlayerToRoom(room, playerSocketId, playerName);

    expect(newPlayer).toBeDefined();
    expect(newPlayer.id).toBeDefined();
    expect(newPlayer.socketId).toBe(playerSocketId);
    expect(newPlayer.name).toBe(playerName);
    expect(newPlayer.isHost).toBe(false);
    expect(newPlayer.isConnected).toBe(true);
    expect(room.players.length).toBe(2); // Host + Player
  });

  it('should remove a player from a room', () => {
    const { data: room } = createRoom([], 'host-socket', 'Admin');
    const p1 = addPlayerToRoom(room, 'socket-1', 'Player 1');
    const p2 = addPlayerToRoom(room, 'socket-2', 'Player 2');

    expect(room.players.length).toBe(3);

    // remove by player ID
    removePlayerFromRoom(room, p1.id);

    expect(room.players.length).toBe(2);
    expect(room.players.find(p => p.socketId === 'socket-1')).toBeUndefined();
    expect(room.players.find(p => p.socketId === 'socket-2')).toBeDefined();
  });

  it('should get non-host players', () => {
    const { data: room } = createRoom([], 'host-socket', 'Admin');
    addPlayerToRoom(room, 'socket-1', 'Player 1');
    addPlayerToRoom(room, 'socket-2', 'Player 2');

    const nonHosts = getNonHostPlayers(room);

    expect(nonHosts.length).toBe(2);
    expect(nonHosts.find(p => p.isHost)).toBeUndefined();
  });

  it('should cleanup room timers', () => {
    const { data: room } = createRoom([], 'host-socket', 'Admin');
    
    // Mock clearTimeout
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    room.timer = setTimeout(() => {}, 1000);
    
    cleanupRoom(room);
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(room.timer).toBeNull();
    
    clearTimeoutSpy.mockRestore();
  });
});
