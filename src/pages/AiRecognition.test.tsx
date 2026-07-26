import { render, screen } from '@testing-library/react';
import { AiRecognition } from './AiRecognition';

describe('AI recognition page', () => {
  it('always labels the current adapter as demo mode', () => {
    render(
      <AiRecognition
        aiStage="idle"
        aiResult={null}
        aiError={null}
        scenario="healthy"
        setScenario={() => undefined}
        runRecognition={async () => undefined}
      />,
    );
    expect(screen.getByText('演示识别模式')).toBeDefined();
    expect(screen.getByText(/\u672a\u8fd0\u884c YOLO \u6216 YieldNet/)).toBeDefined();
  });
});
