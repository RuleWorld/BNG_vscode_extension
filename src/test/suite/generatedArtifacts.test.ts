import * as assert from 'assert';
import { isGeneratedArtifactPath, shouldCloseGeneratedArtifactTabInput } from '../../utils/generatedArtifacts';

suite('Generated Artifact Tabs', () => {
    test('recognizes generated artifact file extensions', () => {
        assert.strictEqual(isGeneratedArtifactPath('/tmp/model.gdat'), true);
        assert.strictEqual(isGeneratedArtifactPath('/tmp/model.cdat'), true);
        assert.strictEqual(isGeneratedArtifactPath('/tmp/model.scan'), true);
        assert.strictEqual(isGeneratedArtifactPath('/tmp/model.graphml'), true);
        assert.strictEqual(isGeneratedArtifactPath('/tmp/model.bngl'), false);
    });

    test('recognizes artifact text-like tab inputs as closable', () => {
        const artifactText = { uri: { fsPath: '/tmp/model.gdat' } };
        const artifactDiff = {
            original: { fsPath: '/tmp/model.graphml' },
            modified: { fsPath: '/tmp/model.bngl' }
        };
        const modelText = { uri: { fsPath: '/tmp/model.bngl' } };

        assert.strictEqual(shouldCloseGeneratedArtifactTabInput(artifactText), true);
        assert.strictEqual(shouldCloseGeneratedArtifactTabInput(artifactDiff), true);
        assert.strictEqual(shouldCloseGeneratedArtifactTabInput(modelText), false);
    });
});
