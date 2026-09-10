export type SopStatus = 'generating' | 'ready' | 'failed';

export type LogLine = {
  id: number;
  text: string;
};

// A file the user attached, plus the path it should land at under inputs/ — just its
// name for a loose file, or "<folder>/<name>" when picked from inside a folder (the
// pipeline treats a subdirectory of inputs/ as one related-document set).
export type PickedFile = {
  file: File;
  relativePath: string;
};

export type Sop = {
  id: string;
  name: string;
  files: PickedFile[];
  status: SopStatus;
  error?: string;
  content?: string;
  gapsMarkdown?: string;
};

