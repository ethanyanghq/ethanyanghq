// Regions used by effects, in fractions of the source image (src/homunculus_loxodontus_prepped.png),
// so they map onto a grid of any size through the converter's crop (ASCII.crop).
// eye: the Homunculus's pupil hole (measured: pixels 776-795 x 263-282 of 971 x 607).
export const eye = { x0: 0.7992, x1: 0.8198, y0: 0.4333, y1: 0.4662 };
// focus: the point the viewport crop keeps in view when it cannot show the whole painting
// (the homunculus's head; it sits at x 0.63-0.95, y 0.40-1.0).
export const focus = { x: 0.80, y: 0.58 };
