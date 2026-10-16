import { ref } from 'vue'

// Phones only: touch screens narrower than a tablet (portrait) or very short (landscape).
// Tablets, laptops and desktops never match.
const PHONE_QUERY = '(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)'

const media = window.matchMedia(PHONE_QUERY)
export const isPhone = ref(media.matches)
media.addEventListener('change', () => { isPhone.value = media.matches })
