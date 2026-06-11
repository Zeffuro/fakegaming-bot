import { Constants } from 'twisted';

export const Regions = Constants.Regions;
export const RegionGroups = Constants.RegionGroups;

export type Regions = (typeof Regions)[keyof typeof Regions];
export type RegionGroups = (typeof RegionGroups)[keyof typeof RegionGroups];
export type AccountAPIRegionGroups = Exclude<RegionGroups, typeof RegionGroups.SEA>;

export function regionToRegionGroup(region: Regions | string): RegionGroups {
    return Constants.regionToRegionGroup(region as Regions);
}

export function regionToRegionGroupForAccountAPI(region: Regions | string): AccountAPIRegionGroups {
    return Constants.regionToRegionGroupForAccountAPI(region as Regions);
}
