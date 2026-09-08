(() => {
  const load = async () => {
    const parts = await Promise.all(Array.from({ length: 6 }, async (_, i) => {
      const name = String(i).padStart(2, '0');
      const response = await fetch('web-patcher/' + name + '.b64', { cache: 'no-store' });
      if (!response.ok) throw new Error('Kiosk patcher files are missing.');
      return response.text();
    }));
    const packed = Uint8Array.from(atob(parts.join('')), c => c.charCodeAt(0));
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const source = new TextDecoder().decode(await new Response(stream).arrayBuffer());
    const script = document.createElement('script');
    script.textContent = source;
    document.head.appendChild(script);
    script.remove();

    const upgrade = () => {
      const oldPanel = document.getElementById('kiosk-iso-sequence-patcher-panel');
      if (!oldPanel || oldPanel.dataset.pfpCurrentPatcher === '1') return;
      oldPanel.remove();
      const panel = window.PfpKioskCurrent && window.PfpKioskCurrent.installKioskIsoPatcherPanel
        ? window.PfpKioskCurrent.installKioskIsoPatcherPanel(document.body)
        : null;
      if (panel) panel.dataset.pfpCurrentPatcher = '1';
    };

    new MutationObserver(upgrade).observe(document.documentElement, { childList: true, subtree: true });
    upgrade();
  };

  load().catch(error => console.error(error));
})();
