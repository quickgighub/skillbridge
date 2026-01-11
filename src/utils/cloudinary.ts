import { Cloudinary } from '@cloudinary/url-gen';

// Try to get the full Cloudinary URL from environment
const cloudinaryUrl = import.meta.env.CLOUDINARY_URL;

// Parse the Cloudinary URL if available
let cloudName = 'demo';
let uploadPreset = 'ml_default';

if (cloudinaryUrl) {
  try {
    // Parse cloudinary://api_key:api_secret@cloud_name
    const url = new URL(cloudinaryUrl.replace('cloudinary://', 'http://'));
    cloudName = url.hostname;
    console.log('Parsed Cloudinary URL, cloudName:', cloudName);
  } catch (error) {
    console.error('Error parsing CLOUDINARY_URL:', error);
  }
} else {
  // Fallback to individual env variables
  cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
  uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';
}

console.log('Cloudinary Config:', {
  cloudName,
  uploadPreset,
  hasFullUrl: !!cloudinaryUrl,
  isDemo: cloudName === 'demo'
});

// Initialize Cloudinary
export const cld = new Cloudinary({
  cloud: {
    cloudName: cloudName
  }
});

// ... rest of your code remains the same ...

/**
 * Upload file to Cloudinary with fallback support
 */
export const uploadToCloudinary = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const finalCloudName = cloudName;
    const finalUploadPreset = uploadPreset;

    console.log('Uploading to Cloudinary:', {
      finalCloudName,
      finalUploadPreset,
      file: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      isDemo: finalCloudName === 'demo'
    });

    // Demo account warning
    if (finalCloudName === 'demo') {
      console.warn('Using Cloudinary demo account. Uploads are temporary.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', finalUploadPreset);

    fetch(`https://api.cloudinary.com/v1_1/${finalCloudName}/upload`, {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            console.error('Cloudinary API error:', {
              status: response.status,
              error: errorData
            });
            
            // For demo account or failures, use local object URL
            const objectUrl = URL.createObjectURL(file);
            console.warn('Using local object URL as fallback:', objectUrl);
            resolve(objectUrl);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.secure_url) {
          console.log('Upload successful:', {
            url: data.secure_url,
            publicId: data.public_id
          });
          resolve(data.secure_url);
        } else {
          console.error('Upload failed, no secure_url:', data);
          // Fallback to local URL
          const objectUrl = URL.createObjectURL(file);
          console.warn('Using local object URL:', objectUrl);
          resolve(objectUrl);
        }
      })
      .catch(error => {
        console.error('Upload network error:', error);
        // Final fallback
        const objectUrl = URL.createObjectURL(file);
        console.warn('Using local object URL after network error:', objectUrl);
        resolve(objectUrl);
      });
  });
};

/**
 * Force download file from URL (without opening new tab)
 */
export const downloadFile = async (url: string, fileName: string): Promise<boolean> => {
  try {
    console.log('Starting download:', { url, fileName });

    // If it's a blob URL (local file), handle it directly
    if (url.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        // Don't revoke immediately to allow download to complete
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 100);
      
      return true;
    }

    // For Cloudinary URLs and other external URLs, fetch as blob
    let finalUrl = url;
    
    // Convert Cloudinary URL to direct download URL if needed
    if (url.includes('cloudinary.com')) {
      // Remove any query parameters and add fl_attachment for force download
      const baseUrl = url.split('?')[0];
      finalUrl = `${baseUrl}?fl_attachment`;
    }

    console.log('Fetching from URL:', finalUrl);
    
    // Fetch the file as a blob
    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
    console.log('Download initiated successfully');
    return true;
    
  } catch (error) {
    console.error('Download failed:', error);
    
    // Fallback: try to open in new tab as last resort
    try {
      console.log('Trying fallback download method');
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      return true;
    } catch (fallbackError) {
      console.error('Fallback download also failed:', fallbackError);
      return false;
    }
  }
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Check if URL is a Cloudinary URL
 */
export const isCloudinaryUrl = (url: string): boolean => {
  return url.includes('cloudinary.com');
};

/**
 * Extract public ID from Cloudinary URL
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
  if (!url) return null;
  if (url.startsWith('blob:')) return null;
  
  const match = url.match(/\/upload(?:\/[^\/]+)?\/([^.]+)/);
  return match ? match[1] : null;
};

/**
 * Generate optimized delivery URL
 */
export const getOptimizedUrl = (url: string, width?: number, height?: number): string => {
  if (!url || url.startsWith('blob:')) return url;
  
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return url;

  let transformation = '';
  if (width) transformation += `w_${width},`;
  if (height) transformation += `h_${height},`;
  if (transformation) transformation += 'c_fill,q_auto,f_auto';

  return transformation 
    ? `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`
    : url;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if Cloudinary is properly configured
 */
export const checkCloudinaryConfig = (): { configured: boolean; isDemo: boolean; message: string } => {
  const isDemo = cloudName === 'demo';
  
  return {
    configured: !isDemo,
    isDemo,
    message: isDemo 
      ? 'Using Cloudinary demo account. Uploads are temporary. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env for permanent storage.'
      : 'Cloudinary is properly configured.'
  };
};

/**
 * Sanitize filename for download
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 255); // Limit length
};

/**
 * Get MIME type from filename
 */
export const getMimeType = (filename: string): string => {
  const ext = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'txt': 'text/plain',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};