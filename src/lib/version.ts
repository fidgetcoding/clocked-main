// Declare the build time injected by Vite
declare const __BUILD_TIME__: string;

// Major version - update manually for significant changes
const MAJOR_VERSION = 1;

// Get build number from build timestamp
function getBuildNumber(): string {
  try {
    const buildDate = new Date(__BUILD_TIME__);
    const month = String(buildDate.getMonth() + 1).padStart(2, '0');
    const day = String(buildDate.getDate()).padStart(2, '0');
    const hours = String(buildDate.getHours()).padStart(2, '0');
    const minutes = String(buildDate.getMinutes()).padStart(2, '0');
    // Format: MMDD.HHmm (e.g., 0202.0854)
    return `${month}${day}.${hours}${minutes}`;
  } catch {
    return '0000.0000';
  }
}

export function getAppVersion(): string {
  return `v${MAJOR_VERSION}.${getBuildNumber()}`;
}

export function getBuildDate(): string {
  try {
    return new Date(__BUILD_TIME__).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}
