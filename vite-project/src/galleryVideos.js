/**
 * The 10 videos shown in the gallery.
 *
 * Drop your files into `public/videos/` using the names below
 * (1.mp4, 2.mp4, ... 10.mp4) and they show up automatically — nothing else
 * needs to change. Until a file exists, its tile renders a soft placeholder
 * so the page never looks broken.
 *
 * Each entry supports:
 *   id     – stable key for React + lightbox navigation
 *   src    – path (or full URL) of the video file
 *   title  – caption on the tile and in the lightbox
 *   poster – optional thumbnail image, e.g. "/videos/posters/1.jpg".
 *            Leave it out and the browser uses the video's first frame.
 */

export const galleryVideos = [
  { id: 1, src: "/videos/1.mp4", title: "گوبه" },
  { id: 2, src: "/videos/2.mp4", title: "نمیدونم" },
  { id: 3, src: "/videos/3.mp4", title: "عجب ادیتی" },
  { id: 4, src: "/videos/4.mp4", title: "بهترین رفیق نگار" },
  { id: 5, src: "/videos/5.mp4", title: "کفتر خونه نگار" },
  { id: 6, src: "/videos/6.mp4", title: "منما" },
  { id: 7, src: "/videos/7.mp4", title: "ویدیوی ۷" },
  { id: 8, src: "/videos/8.mp4", title: "ویدیوی ۸" },
  { id: 9, src: "/videos/9.mp4", title: "ویدیوی ۹" },
  { id: 10, src: "/videos/10.mp4", title: "ویدیوی ۱۰" },
];

export default galleryVideos;