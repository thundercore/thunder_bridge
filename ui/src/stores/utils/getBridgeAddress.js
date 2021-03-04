let cache = undefined;

function parseBridgeEnv(env) {
  const segments = env.split("_");
  return [segments[3], segments[2]];
}

function loadBridgeAddress() {
  const m = {};
  for (const key in process.env) {
    if (key.includes("BRIDGE_ADDRESS")) {
      const [tokenName, network] = parseBridgeEnv(key);
      if (!m[tokenName]) {
        m[tokenName] = {};
      }
      m[tokenName][network.toLowerCase()] = process.env[key];
    }
  }
  return m;
}

export function getBridgeAddress(tokenName, network) {
  if (!cache) {
    cache = loadBridgeAddress();
  }

  if (!cache[tokenName]) {
    return "";
  }

  if (!cache[tokenName][network]) {
    return "";
  }

  return cache[tokenName][network];
}

export function getTokenList() {
  if (process.env.REACT_APP_BRIDGE_TOKENS)
    return process.env.REACT_APP_BRIDGE_TOKENS.split(" ");
  if (!cache) {
    cache = loadBridgeAddress();
  }
  return Object.keys(cache);
}
