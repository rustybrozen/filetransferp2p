

const FLOWERS = [
  "LOTUS", "ROSE", "LILY", "TULIP", "DAISY",
  "ORCHID", "JASMINE", "CHERRY", "POPPY", "IRIS",
  "CACTUS", "BAMBOO", "PINE", "CEDAR", "MINT",
  "CHAMOMILE", "LAVENDER", "VIOLET", "LILAC"
];

export const generateIdentity = () => {
  const flower = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${flower}-${num}`;
};

export const getStoredIdentity = () => {
  if (typeof window === 'undefined') return "";

  let storedName = localStorage.getItem("p2p_username");

  if (!storedName) {
    storedName = generateIdentity();
    localStorage.setItem("p2p_username", storedName);
  }

  return storedName;
};


export const getDeviceId = () => {
  if (typeof window === 'undefined') return "server-side-id";

  let deviceId = localStorage.getItem("p2p_device_id");
  if (!deviceId) {
    deviceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("p2p_device_id", deviceId);
  }
  return deviceId;
};

