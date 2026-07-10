import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REACT Notebook Helper",
    short_name: "REACT Notes",
    description: "Student progress and image tracking for REACT Robotics",
    start_url: "/",
    display: "standalone",
    background_color: "#1C1F23",
    theme_color: "#1C1F23",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
