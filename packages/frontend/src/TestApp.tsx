import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>DwayBank - Loading...</h1>
      <p>If you can see this, React is working!</p>
      <button onClick={() => alert('Button works!')}>Test Button</button>
    </div>
  );
};

export default TestApp;