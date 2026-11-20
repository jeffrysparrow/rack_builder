export const rackPhotos = [
  { slug: 'four-by-four-tote-rack', title: 'Four-by-four rolling tote rack', alt: 'A wooden four-by-four rack on casters filled with black storage totes and yellow lids', portrait: false },
  { slug: 'wide-three-row-tote-rack', title: 'Low, wide tote storage', alt: 'A wide wooden rack with three rows of totes and a continuous top', portrait: false },
  { slug: 'garage-wall-tote-storage', title: 'Full garage-wall storage', alt: 'A wood tote rack fitted along a garage wall with rows of black and yellow bins', portrait: false },
  { slug: 'two-sided-garage-storage', title: 'Storage on both sides of a garage', alt: 'Two long wooden tote racks along opposite garage walls with an open center aisle', portrait: false },
  { slug: 'tote-rack-with-open-shelf', title: 'Tote rack with an open shelf', alt: 'A wide wood rack with tote bays above and below a full-width open shelf', portrait: true },
  { slug: 'mixed-rack-and-shelves', title: 'Mixed tote bays and shelves', alt: 'An empty rolling wood rack showing narrow tote bays and wide solid shelves', portrait: false },
  { slug: 'rolling-garage-shelves', title: 'Rolling open shelves', alt: 'A narrow unfinished wooden shelving unit on orange casters in front of a garage door', portrait: true },
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

const compactRack = { slug: 'compact-rolling-tote-rack', alt: 'A plywood-topped rolling rack holding six totes, two high and three across', width: 1024, height: 768 };
const tallRack = { slug: 'tall-rolling-tote-rack', alt: 'A rolling wooden rack holding twenty totes, five high and four across', width: 1024, height: 1365 };
const cornerWorkbench = { slug: 'corner-workbench', alt: 'An L-shaped plywood workbench on casters with open space and tote rails below', width: 1024, height: 768 };
const centerShelfRack = { slug: 'center-shelf-tote-rack', alt: 'A rolling wood rack with a wide set of shelves between two tote bays', width: 1024, height: 768 };

const additionalStandardPhotos = [
  { slug: 'two-height-rolling-racks', alt: 'Two loaded tote racks of different heights set side by side', width: 1024, height: 768 },
  { slug: 'hdx-four-by-four-front', alt: 'Four rows of yellow-lidded HDX totes on a wide rolling wooden rack', width: 1024, height: 768 },
  { slug: 'red-lid-six-tote-rack', alt: 'A low rolling rack with six black totes and red lids', width: 480, height: 360 },
  { slug: 'stationary-tote-rack', alt: 'A tall stationary tote rack fitted beside a water heater', width: 768, height: 1024 },
  { slug: 'garage-wall-racks-front', alt: 'Two adjacent tall tote racks filled with yellow-lidded bins', width: 480, height: 360 },
  { slug: 'rolling-four-by-four-front', alt: 'Front view of a four-high, four-across rolling tote rack with yellow-lidded bins', width: 480, height: 360 },
  { slug: 'rolling-four-by-four-end', alt: 'End view of a four-high, four-across rolling rack with a plywood top', width: 360, height: 480 },
  { slug: 'hdx-four-by-four-angle', alt: 'A loaded HDX tote rack on orange casters inside a garage', width: 768, height: 1024 },
  { slug: 'hdx-four-by-four-end', alt: 'A side view of a plywood-topped HDX rack beside an open garage door', width: 1024, height: 768 },
  { slug: 'red-lid-six-tote-rack-top', alt: 'An angled view of the solid top on a rolling six-tote rack', width: 360, height: 480 },
  { slug: 'three-high-rolling-rack-front', alt: 'Straight-on view of a rolling tote rack three high and four across', width: 768, height: 1024 },
  { slug: 'compact-rack-rear-bracing', alt: 'Rear and end view of a two-high rolling rack showing the plywood bracing', width: 768, height: 1024 },
  { slug: 'compact-rolling-rack-front', alt: 'A low wooden rack on casters with yellow-lidded totes two high and three across', width: 768, height: 1024 },
  { slug: 'long-empty-rolling-tote-rack', alt: 'A long row of empty wooden tote bays on casters', width: 1024, height: 768 },
  { slug: 'stationary-wide-tote-rack', alt: 'A wide stationary rack with a solid top and empty tote rails in a garage', width: 768, height: 1024 },
  { slug: 'tall-rolling-tote-rack-front', alt: 'Straight-on view of five rows of yellow-lidded totes in a rolling rack', width: 768, height: 1024 },
  { slug: 'garage-wall-racks-entrance', alt: 'Tall loaded tote racks seen from the edge of an open garage', width: 480, height: 360 },
  { slug: 'garage-wall-rack-rail-detail', alt: 'Close side view of a long wall of loaded wooden tote racks', width: 360, height: 480 },
  { slug: 'garage-wall-racks-side', alt: 'A full wall of black and yellow totes seen from inside a garage', width: 480, height: 360 },
  { slug: 'garage-wall-racks-opposite-wall', alt: 'A wide row of loaded wooden tote racks on the opposite garage wall', width: 480, height: 360 },
];

const additionalCustomPhotos = [
  { slug: 'long-garage-wall-workbench', alt: 'A long plywood work surface with tote rails underneath along a garage wall', width: 1024, height: 768 },
  { slug: 'stepped-garage-workstation', alt: 'A tall rolling rack joined by a lower tote workbench and wall-mounted tool storage', width: 1024, height: 768 },
  { slug: 'rolling-workbench-with-upper-frame', alt: 'A rolling workbench with a full-width plywood surface above red-lidded totes', width: 768, height: 1024 },
  { slug: 'rolling-tote-rack-work-shelf', alt: 'Loaded rolling rack with a full-width work shelf between upper and lower tote bays', width: 768, height: 1024 },
  { slug: 'shed-wall-workbench', alt: 'A long plywood-topped workbench with tote bays underneath in a shed', width: 1024, height: 768 },
  { slug: 'mixed-storage-builds-together', alt: 'Three rolling builds shown together with tote rails, open work space and solid tops', width: 480, height: 360 },
  { slug: 'tote-bays-and-side-shelves', alt: 'A red-lidded tote beside three wide open shelves in a rolling wood rack', width: 1024, height: 768 },
  { slug: 'tote-bays-and-side-shelves-angle', alt: 'Angled view of a rolling rack with tote rails on one side and shelves on the other', width: 768, height: 1024 },
  { slug: 'rolling-open-shelves-front', alt: 'Front view of a narrow rolling unit with three open plywood shelves', width: 768, height: 1024 },
  { slug: 'rolling-workbench-with-upper-frame-angle', alt: 'End view of a rolling tote workbench and the open frame above the work surface', width: 768, height: 1024 },
];

export type RackPhoto = typeof rackPhotos[number] | typeof compactRack;
export const rackPhotoGroups = [
  { id: 'standard', title: 'Standard tote racks', photos: [compactRack, rackPhotos[0], tallRack, rackPhotos[1], ...additionalStandardPhotos, rackPhotos[2], rackPhotos[3]] },
  { id: 'custom', title: 'Custom builds', photos: [cornerWorkbench, centerShelfRack, ...additionalCustomPhotos, rackPhotos[4], rackPhotos[5], rackPhotos[6]] },
];
export const carouselImageSizes = '(max-width: 580px) 82vw, (max-width: 850px) 44vw, 32vw';
