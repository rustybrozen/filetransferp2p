import { create } from "zustand";

interface PeerState {
  myId: string;
  usersInRoom: { id: string; name: string }[];
  setMyId: (id: string) => void;
  addUser: (user: { id: string; name: string }) => void;
  removeUser: (id: string) => void;
  setUsers: (users: { id: string; name: string }[]) => void;
}

export const usePeerStore = create<PeerState>((set) => ({
  myId: "",
  usersInRoom: [],
  setMyId: (id) => set({ myId: id }),
  addUser: (user) =>
    set((state) => ({
      usersInRoom: [...state.usersInRoom.filter((u) => u.id !== user.id), user],
    })),
  removeUser: (id) =>
    set((state) => ({
      usersInRoom: state.usersInRoom.filter((u) => u.id !== id),
    })),
  setUsers: (users) => set({ usersInRoom: users }),
}));


