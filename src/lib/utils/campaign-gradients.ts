const campaignGradients = [
  "bg-gradient-to-br from-rose-500 to-red-600 dark:from-sky-500 dark:to-blue-600",
  "bg-gradient-to-br from-orange-500 to-red-500 dark:from-indigo-500 dark:to-sky-500",
  "bg-gradient-to-br from-amber-500 to-rose-500 dark:from-emerald-500 dark:to-teal-500",
  "bg-gradient-to-br from-fuchsia-500 to-rose-600 dark:from-purple-500 dark:to-indigo-500",
  "bg-gradient-to-br from-emerald-500 to-lime-500 dark:from-emerald-500 dark:to-cyan-500",
  "bg-gradient-to-br from-yellow-500 to-orange-500 dark:from-amber-500 dark:to-orange-500",
  "bg-gradient-to-br from-red-500 to-orange-600 dark:from-pink-500 dark:to-rose-500",
  "bg-gradient-to-br from-purple-500 to-red-500 dark:from-violet-500 dark:to-fuchsia-500",
] as const;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getCampaignCoverGradient = (seed: string) => {
  const safeSeed = seed || "campaign";
  const index = hashString(safeSeed) % campaignGradients.length;
  return campaignGradients[index];
};
