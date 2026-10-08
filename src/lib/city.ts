import cityConfig from '../../city.config.json'

// The installation's city, municipality and Supabase project — everything
// that differs between one municipality's copy of the site and another's.
// Edit city.config.json (see installer/README.md), never the values here.

export const CITY = cityConfig.city
export const ORG = cityConfig.org
export const MAP_CENTER: { lat: number; lon: number } = cityConfig.map.center
export const SUPABASE_CONFIG = cityConfig.supabase

/** "עיריית ירושלים · אגף הארנונה" */
export const ORG_LINE = [ORG.municipalityHe, ORG.departmentHe].filter(Boolean).join(' · ')
