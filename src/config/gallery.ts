export const rackPhotos = [
  { slug: 'four-by-four-tote-rack', title: '4 × 4 rolling rack', alt: 'A wooden four-by-four rack on casters filled with black storage totes and yellow lids', portrait: false },
  { slug: 'wide-three-row-tote-rack', title: 'Low, wide tote storage', alt: 'A wide wooden rack with three rows of totes and a continuous top', portrait: false },
  { slug: 'garage-wall-tote-storage', title: 'Full garage-wall setup', alt: 'A wood tote rack fitted along a garage wall with rows of black and yellow bins', portrait: false },
  { slug: 'two-sided-garage-storage', title: 'Storage on both sides of a garage', alt: 'Two long wooden tote racks along opposite garage walls with an open center aisle', portrait: false },
  { slug: 'tote-rack-with-open-shelf', title: 'Tote rack with an open shelf', alt: 'A wide wood rack with tote bays above and below a full-width open shelf', portrait: true },
  { slug: 'mixed-rack-and-shelves', title: 'Mixed tote bays and shelves', alt: 'An empty rolling wood rack showing narrow tote bays and wide solid shelves', portrait: false },
  { slug: 'rolling-garage-shelves', title: 'Rolling rack with open shelves', alt: 'A narrow unfinished wooden shelving unit on orange casters in front of a garage door', portrait: true },
];

export function rackPhotoSource(photo: RackPhoto) {
  if ('width' in photo) {
    const full = `/racks/${photo.slug}-${photo.width}.jpg`;
    const src = photo.width > 720 ? `/racks/${photo.slug}-720.jpg` : full;
    const fullCandidate = `${full} ${photo.width}w`;
    const srcSet = src === full ? fullCandidate : `${src} 720w, ${fullCandidate}`;
    return { src, full, srcSet, width: photo.width, height: photo.height };
  }
  return {
    src: `/racks/${photo.slug}-720.webp`,
    full: `/racks/${photo.slug}-1440.webp`,
    srcSet: `/racks/${photo.slug}-720.webp 720w, /racks/${photo.slug}-1440.webp ${photo.portrait ? 1200 : 1440}w`,
    width: 720, height: photo.portrait ? 960 : 540,
  };
}

const compactRack = { slug: 'compact-rolling-tote-rack', title: 'Six-tote rolling rack with a plywood top', alt: 'A plywood-topped rolling rack holding six totes, two high and three across', width: 1024, height: 768 };
const tallRack = { slug: 'tall-rolling-tote-rack', title: '5 × 4 rolling rack', alt: 'A rolling wooden rack holding twenty totes, five high and four across', width: 1024, height: 1365 };
const cornerWorkbench = { slug: 'corner-workbench', title: 'Custom corner workbench', alt: 'An L-shaped plywood workbench on casters with open space and tote rails below', width: 1024, height: 768 };
const centerShelfRack = { slug: 'center-shelf-tote-rack', title: 'Rolling rack with center shelves', alt: 'A rolling wood rack with a wide set of shelves between two tote bays', width: 1024, height: 768 };

const additionalStandardPhotos = [
  { slug: 'two-height-rolling-racks', title: 'Two rolling racks side by side', alt: 'Two loaded tote racks of different heights set side by side', width: 1024, height: 768 },
  { slug: 'hdx-four-by-four-front', title: '4 × 4 HDX tote rack, front view', alt: 'Four rows of yellow-lidded HDX totes on a wide rolling wooden rack', width: 1024, height: 768 },
  { slug: 'red-lid-six-tote-rack', title: 'Six-tote rolling rack with red lids', alt: 'A low rolling rack with six black totes and red lids', width: 480, height: 360 },
  { slug: 'stationary-tote-rack', title: 'Tall stationary tote rack', alt: 'A tall stationary tote rack fitted beside a water heater', width: 768, height: 1024 },
  { slug: 'garage-wall-racks-front', title: 'Full garage-wall setup, front view', alt: 'Two adjacent tall tote racks filled with yellow-lidded bins', width: 480, height: 360 },
  { slug: 'rolling-four-by-four-front', title: '4 × 4 rolling rack, front view', alt: 'Front view of a four-high, four-across rolling tote rack with yellow-lidded bins', width: 480, height: 360 },
  { slug: 'rolling-four-by-four-end', title: '4 × 4 rolling rack, plywood top', alt: 'End view of a four-high, four-across rolling rack with a plywood top', width: 360, height: 480 },
  { slug: 'hdx-four-by-four-angle', title: '4 × 4 HDX tote rack on wheels', alt: 'A loaded HDX tote rack on orange casters inside a garage', width: 768, height: 1024 },
  { slug: 'hdx-four-by-four-end', title: '4 × 4 HDX tote rack, side view', alt: 'A side view of a plywood-topped HDX rack beside an open garage door', width: 1024, height: 768 },
  { slug: 'red-lid-six-tote-rack-top', title: 'Six-tote rolling rack, solid top', alt: 'An angled view of the solid top on a rolling six-tote rack', width: 360, height: 480 },
  { slug: 'three-high-rolling-rack-front', title: '3 × 4 rolling rack, front view', alt: 'Straight-on view of a rolling tote rack three high and four across', width: 768, height: 1024 },
  { slug: 'compact-rack-rear-bracing', title: 'Compact rolling rack, rear bracing', alt: 'Rear and end view of a two-high rolling rack showing the plywood bracing', width: 768, height: 1024 },
  { slug: 'compact-rolling-rack-front', title: '2 × 3 rolling rack, front view', alt: 'A low wooden rack on casters with yellow-lidded totes two high and three across', width: 768, height: 1024 },
  { slug: 'long-empty-rolling-tote-rack', title: 'Rolling rack with open tote bays', alt: 'A long row of empty wooden tote bays on casters', width: 1024, height: 768 },
  { slug: 'stationary-wide-tote-rack', title: 'Wide stationary tote rack', alt: 'A wide stationary rack with a solid top and empty tote rails in a garage', width: 768, height: 1024 },
  { slug: 'tall-rolling-tote-rack-front', title: '5 × 4 rolling rack, front view', alt: 'Straight-on view of five rows of yellow-lidded totes in a rolling rack', width: 768, height: 1024 },
  { slug: 'garage-wall-racks-entrance', title: 'Garage-wall racks from the entrance', alt: 'Tall loaded tote racks seen from the edge of an open garage', width: 480, height: 360 },
  { slug: 'garage-wall-rack-rail-detail', title: 'Garage-wall rack, rail detail', alt: 'Close side view of a long wall of loaded wooden tote racks', width: 360, height: 480 },
  { slug: 'garage-wall-racks-side', title: 'Garage-wall setup, side view', alt: 'A full wall of black and yellow totes seen from inside a garage', width: 480, height: 360 },
  { slug: 'garage-wall-racks-opposite-wall', title: 'Tote racks along the opposite wall', alt: 'A wide row of loaded wooden tote racks on the opposite garage wall', width: 480, height: 360 },
];

const additionalCustomPhotos = [
  { slug: 'long-garage-wall-workbench', title: 'Garage-wall workbench', alt: 'A long plywood work surface with tote rails underneath along a garage wall', width: 1024, height: 768 },
  { slug: 'stepped-garage-workstation', title: 'Two-height garage workstation', alt: 'A tall rolling rack joined by a lower tote workbench and wall-mounted tool storage', width: 1024, height: 768 },
  { slug: 'rolling-workbench-with-upper-frame', title: 'Rolling workbench with space above', alt: 'A rolling workbench with a full-width plywood surface above red-lidded totes', width: 768, height: 1024 },
  { slug: 'rolling-tote-rack-work-shelf', title: 'Tote rack with work shelf', alt: 'Loaded rolling rack with a full-width work shelf between upper and lower tote bays', width: 768, height: 1024 },
  { slug: 'shed-wall-workbench', title: 'Shed workbench with tote storage', alt: 'A long plywood-topped workbench with tote bays underneath in a shed', width: 1024, height: 768 },
  { slug: 'mixed-storage-builds-together', title: 'Three rolling storage builds', alt: 'Three rolling builds shown together with tote rails, open work space and solid tops', width: 480, height: 360 },
  { slug: 'tote-bays-and-side-shelves', title: 'Tote rack with open side shelves', alt: 'A red-lidded tote beside three wide open shelves in a rolling wood rack', width: 1024, height: 768 },
  { slug: 'tote-bays-and-side-shelves-angle', title: 'Tote rack with side shelves, angled view', alt: 'Angled view of a rolling rack with tote rails on one side and shelves on the other', width: 768, height: 1024 },
  { slug: 'rolling-open-shelves-front', title: 'Rolling rack with open shelves, front view', alt: 'Front view of a narrow rolling unit with three open plywood shelves', width: 768, height: 1024 },
  { slug: 'rolling-workbench-with-upper-frame-angle', title: 'Rolling workbench, end view', alt: 'End view of a rolling tote workbench and the open frame above the work surface', width: 768, height: 1024 },
];

export type RackPhoto = typeof rackPhotos[number] | typeof compactRack;
export const rackPhotoGroups = [
  { id: 'standard', title: 'Tote racks', photos: [compactRack, rackPhotos[0], tallRack, rackPhotos[1], ...additionalStandardPhotos, rackPhotos[2], rackPhotos[3]] },
  { id: 'custom', title: 'Custom projects', photos: [cornerWorkbench, centerShelfRack, ...additionalCustomPhotos, rackPhotos[4], rackPhotos[5], rackPhotos[6]] },
];
export const carouselImageSizes = '(max-width: 580px) 82vw, (max-width: 850px) 44vw, 32vw';
