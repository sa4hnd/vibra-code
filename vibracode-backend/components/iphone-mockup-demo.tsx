// Demo component to test the iPhone mockup
// You can use this to see how it looks

import IPhoneMockup from "./iphone-mockup";

export function IPhoneMockupDemo() {
  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-8 text-center">iPhone Mockup Demo</h1>
      
      {/* Demo with URL */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">With URL (iframe)</h2>
        <IPhoneMockup url="https://example.com" />
      </div>
      
      {/* Demo with custom content */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">With Custom Content</h2>
        <IPhoneMockup>
          <div className="text-center text-white">
            <h3 className="text-xl font-bold mb-2">Hello World!</h3>
            <p className="text-sm opacity-80">This is custom content inside the iPhone mockup</p>
          </div>
        </IPhoneMockup>
      </div>
      
      {/* Demo with default Apple logo */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Default (Apple Logo)</h2>
        <IPhoneMockup />
      </div>
    </div>
  );
}
