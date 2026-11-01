// One image per glove and badge, under public/art. Filenames match the ids in src/data.
const artUrl = (folder: string, id: string) => `${import.meta.env.BASE_URL}art/${folder}/${id}.webp`;

export const gloveArtUrl = (gloveId: string) => artUrl('gloves', gloveId);
export const badgeArtUrl = (badgeId: string) => artUrl('badges', badgeId);
