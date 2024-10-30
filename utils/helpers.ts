// Helper function to check if URL is a GIF
async function isGif(url: string): Promise<boolean> {
  try {
    if (url.toLowerCase().endsWith('.gif')) {
      return true;
    }
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return contentType?.toLowerCase().includes('image/gif') ?? false;
  } catch (error) {
    console.error('Error detecting image type:', error);
    return false;
  }
}

export { isGif };