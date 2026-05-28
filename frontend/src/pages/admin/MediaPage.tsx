import { MediaLibraryPanel } from "@/components/settings/MediaLibraryPanel";

export const MediaPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Media Library</h1>
      <MediaLibraryPanel />
    </div>
  );
};
