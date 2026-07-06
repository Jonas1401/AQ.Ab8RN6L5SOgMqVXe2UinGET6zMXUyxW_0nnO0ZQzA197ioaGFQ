/**
 * Utility to compress and resize images client-side before uploading or saving to Supabase.
 * This prevents hitting the 1MB document size limit of Supabase.
 */
export const compressImage = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Some mobile devices or file systems may pass images with an empty type or generic type.
    // Instead of strictly rejecting, we let the Image loader try to render it.
    // However, if the file is clearly a non-image type (e.g. PDF, text, zip), we can reject early.
    const nonImageTypes = ['application/pdf', 'text/', 'application/zip', 'audio/', 'video/'];
    if (file.type && nonImageTypes.some(type => file.type.startsWith(type))) {
      reject(new Error('O formato do arquivo selecionado não é suportado. Escolha uma imagem (JPG, PNG, HEIC, etc).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Output as image/jpeg to ensure maximum compression efficiency
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Não foi possível processar este formato de imagem no navegador. Por favor, tente enviar em JPG, PNG, WebP ou GIF.'));
      
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error('Nenhum resultado de leitura de arquivo disponível.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
};
