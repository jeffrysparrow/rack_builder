export const rackPhotos = [
  { slug: 'four-by-four-tote-rack', title: 'Four-by-four rolling tote rack', alt: 'A wooden four-by-four rack on casters filled with black storage totes and yellow lids', portrait: false },
  { slug: 'wide-three-row-tote-rack', title: 'Low, wide tote storage', alt: 'A wide wooden rack with three rows of totes and a continuous top', portrait: false },
  { slug: 'garage-wall-tote-storage', title: 'Full garage-wall storage', alt: 'A wood tote rack fitted along a garage wall with rows of black and yellow bins', portrait: false },
  { slug: 'two-sided-garage-storage', title: 'Storage on both sides of a garage', alt: 'Two long wooden tote racks along opposite garage walls with an open center aisle', portrait: false },
  { slug: 'tote-rack-with-open-shelf', title: 'Tote rack with an open shelf', alt: 'A wide wood rack with tote bays above and below a full-width open shelf', portrait: true },
  { slug: 'mixed-rack-and-shelves', title: 'Mixed tote bays and shelves', alt: 'An empty rolling wood rack showing narrow tote bays and wide solid shelves', portrait: false },
  { slug: 'rolling-garage-shelves', title: 'Rolling open shelves', alt: 'A narrow unfinished wooden shelving unit on orange casters in front of a garage door', portrait: true },
];

export function rackPhotoSource(photo: typeof rackPhotos[number]) {
  return {
    src: `/racks/${photo.slug}-720.webp`,
    srcSet: `/racks/${photo.slug}-720.webp 720w, /racks/${photo.slug}-1440.webp ${photo.portrait ? 1200 : 1440}w`,
    width: 720, height: photo.portrait ? 960 : 540,
  };
}
