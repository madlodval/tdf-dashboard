declare module 'alpinejs' {
  const Alpine: {
    start: () => void;
    [key: string]: any;
  };
  export default Alpine;
}

interface Window {
  Alpine: typeof Alpine;
} 