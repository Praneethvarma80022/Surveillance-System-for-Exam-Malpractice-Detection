export const createPageUrl = (pageName) => {
  // Removes leading slash if present to avoid double slashes
  const cleanName = pageName.startsWith('/') ? pageName.substring(1) : pageName;
  return `/${cleanName}`;
};