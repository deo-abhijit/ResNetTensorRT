import os
import torch
import torch.nn.functional as F
import logging
import onnxruntime as ort
import numpy as np
from src.inference_base import InferenceBase
from src.onnx_exporter import ONNXExporter


class ONNXInference(InferenceBase):
    def __init__(self, model_loader, model_path, debug_mode=False):
        """
        Initialize the ONNXInference object.

        :param model_loader: Object responsible for loading the model and categories.
        :param model_path: Path to the ONNX model.
        :param debug_mode: If True, print additional debug information.
        """
        super().__init__(model_loader, onnx_path=model_path, debug_mode=debug_mode)

    def load_model(self):
        """
        Load the ONNX model. If the model does not exist, export it.

        :return: Loaded ONNX model.
        """
        if not os.path.exists(self.onnx_path):
            onnx_exporter = ONNXExporter(
                self.model_loader.model, self.model_loader.device, self.onnx_path
            )
            onnx_exporter.export_model()
        return ort.InferenceSession(self.onnx_path, providers=["CPUExecutionProvider"])

    def predict(self, input_data, is_benchmark=False):
        """
        Run prediction on the input data using the ONNX model.
        """
        super().predict(input_data, is_benchmark=is_benchmark)

        # Prepare the input data for ONNX Runtime
        ort_inputs = {self.ort_session.get_inputs()[0].name: input_data.cpu().numpy()}

        # Run the model inference
        ort_outputs = self.ort_session.run(None, ort_inputs)

        # Extract probabilities from the output
        prob = ort_outputs[0]

        # Apply softmax to the probabilities
        prob = F.softmax(torch.from_numpy(prob), dim=1).numpy()

        return self.get_top_predictions(prob, is_benchmark)

    def benchmark(self, input_data, num_runs=100, warmup_runs=50):
        """
        Benchmark the prediction performance using the ONNX model.

        :param input_data: Data to run the benchmark on.
        :param num_runs: Number of runs for the benchmark.
        :param warmup_runs: Number of warmup runs before the benchmark.
        :return: Average inference time in milliseconds.
        """
        return super().benchmark(input_data, num_runs, warmup_runs)

    def get_top_predictions(self, prob: np.ndarray, is_benchmark=False):
        """
        Get the top predictions based on the probabilities.
        """
        if is_benchmark:
            return None

        # Get the top indices and probabilities
        top_indices = prob.argsort()[-self.topk :][::-1]
        top_probs = prob[top_indices]

        # Prepare the list of predictions
        predictions = []
        for i in range(self.topk):
            probability = top_probs[i]
            class_label = self.categories[0][int(top_indices[i])]
            predictions.append({"label": class_label, "confidence": float(probability)})

            # Log the top predictions
            logging.info(f"#{i + 1}: {probability * 100:.2f}% {class_label}")

        return predictions
