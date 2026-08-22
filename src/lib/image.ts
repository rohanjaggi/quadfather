/**
 * Client-side image prep shared by every upload that ends up at a vision model.
 *
 * Extracted from `components/food/PhotoUpload.tsx`, which is where the rules
 * below were worked out; `components/running/RunPhotoUpload.tsx` hits the same
 * endpoints and needs the same guards.
 */

/**
 * The only formats every vision provider accepts. An iPhone shooting in "High
 * Efficiency" hands over `image/heic`, which the model APIs reject with a bare
 * 422 — so it is caught before upload with a message the user can act on rather
 * than being spent on a failed round trip.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Value for an `<input type="file">` `accept` attribute. */
export const ACCEPT_IMAGE_ATTR = ACCEPTED_IMAGE_TYPES.join(',')

/** Shown when the picked file is a format the providers will reject. */
export const UNSUPPORTED_IMAGE_MESSAGE =
  'That image format isn’t supported. Use JPEG, PNG, WebP or GIF — on iPhone, ' +
  'Settings → Camera → Formats → Most Compatible saves photos as JPEG.'

/** Longest edge, in px, that a photo is downscaled to before upload. */
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.85

/**
 * Shrinks an oversized photo to `MAX_EDGE` and re-encodes it as JPEG. A modern
 * phone camera file is 3–8 MB and ~4000 px wide, all of which is uploaded, sent
 * to the model and billed for — while every provider downsamples it anyway.
 *
 * Anything already within the limit is returned untouched (re-encoding a small
 * PNG or an animated GIF would only make it worse). Any failure falls back to
 * the original file: a large upload beats a broken one.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  // GIFs may be animated; a canvas would flatten them to the first frame.
  if (file.type === 'image/gif') return file

  try {
    // `imageOrientation: 'from-image'` applies the EXIF rotation, so a portrait
    // photo isn't uploaded sideways. Ignored by browsers that don't know it.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    if (longest <= MAX_EDGE) {
      bitmap.close()
      return file
    }

    const scale = MAX_EDGE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
