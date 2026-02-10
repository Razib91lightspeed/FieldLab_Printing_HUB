export const formatTemp = (temp: number): string => `${Math.round(temp)}°C`;

export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
