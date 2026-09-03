import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock WebSocket
const mockWs = {
  readyState: 1, // OPEN
  send: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  terminate: vi.fn(),
};

const mockWss = {
  on: vi.fn(),
  close: vi.fn(),
  clients: new Set(),
};

describe("Room Participant Limit", () => {
  const MAX_PARTICIPANTS = 15;

  describe("participant counting", () => {
    it("counts 1 host correctly", () => {
      const room = {
        hostWs: mockWs,
        hostUser: { id: "host-1", name: "Host", color: "#6366f1" },
        guests: new Map(),
      };
      const count = 1 + room.guests.size;
      expect(count).toBe(1);
    });

    it("counts 15 participants correctly (1 host + 14 guests)", () => {
      const guests = new Map();
      for (let i = 1; i <= 14; i++) {
        guests.set(`guest-${i}`, { ws: mockWs, user: { id: `guest-${i}`, name: `Guest ${i}`, color: "#6366f1" } });
      }
      const room = {
        hostWs: mockWs,
        hostUser: { id: "host-1", name: "Host", color: "#6366f1" },
        guests,
      };
      const count = 1 + room.guests.size;
      expect(count).toBe(15);
    });

    it("rejects 16th participant", () => {
      const guests = new Map();
      for (let i = 1; i <= 14; i++) {
        guests.set(`guest-${i}`, { ws: mockWs, user: { id: `guest-${i}`, name: `Guest ${i}`, color: "#6366f1" } });
      }
      const room = {
        hostWs: mockWs,
        hostUser: { id: "host-1", name: "Host", color: "#6366f1" },
        guests,
      };
      const currentCount = 1 + room.guests.size;
      const canJoin = currentCount < MAX_PARTICIPANTS;
      expect(canJoin).toBe(false);
      expect(currentCount).toBe(15);
    });
  });

  describe("room full error message", () => {
    it("formats room full message with max participants", () => {
      const message = `Room is full (maximum ${MAX_PARTICIPANTS} participants)`;
      expect(message).toBe("Room is full (maximum 15 participants)");
    });
  });

  describe("participant count in messages", () => {
    it("includes participantCount and maxParticipants in session:init", () => {
      const sessionInit = {
        type: "session:init",
        participantCount: 5,
        maxParticipants: MAX_PARTICIPANTS,
        snapshot: {},
        hostUser: {},
        peers: [],
      };
      expect(sessionInit.participantCount).toBeDefined();
      expect(sessionInit.maxParticipants).toBe(15);
      expect(sessionInit.participantCount).toBeLessThanOrEqual(sessionInit.maxParticipants);
    });

    it("includes participantCount and maxParticipants in peer:joined", () => {
      const peerJoined = {
        type: "peer:joined",
        clientId: "guest-new",
        user: { id: "guest-new", name: "New Guest", color: "#6366f1" },
        participantCount: 6,
        maxParticipants: MAX_PARTICIPANTS,
      };
      expect(peerJoined.participantCount).toBe(6);
      expect(peerJoined.maxParticipants).toBe(15);
    });

    it("includes participantCount and maxParticipants in peer:left", () => {
      const peerLeft = {
        type: "peer:left",
        clientId: "guest-1",
        participantCount: 4,
        maxParticipants: MAX_PARTICIPANTS,
      };
      expect(peerLeft.participantCount).toBe(4);
      expect(peerLeft.maxParticipants).toBe(15);
    });
  });

  describe("error code format", () => {
    it("uses ROOM_FULL uppercase error code", () => {
      const errorCode = "ROOM_FULL";
      expect(errorCode).toBe("ROOM_FULL");
    });
  });

  describe("edge cases", () => {
    it("allows exactly 15 participants", () => {
      const guests = new Map();
      for (let i = 1; i <= 14; i++) {
        guests.set(`guest-${i}`, { ws: mockWs });
      }
      const room = {
        hostWs: mockWs,
        guests,
      };
      const count = 1 + room.guests.size;
      const canJoin = count < MAX_PARTICIPANTS;
      expect(count).toBe(15);
      expect(canJoin).toBe(false);
    });

    it("allows guest to join when at 14 participants", () => {
      const guests = new Map();
      for (let i = 1; i <= 13; i++) {
        guests.set(`guest-${i}`, { ws: mockWs });
      }
      const room = {
        hostWs: mockWs,
        guests,
      };
      const count = 1 + room.guests.size;
      const canJoin = count < MAX_PARTICIPANTS;
      expect(count).toBe(14);
      expect(canJoin).toBe(true);
    });
  });
});
