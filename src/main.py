import argparse
import logging
import torch
import torch_tensorrt
from typing import List, Tuple

from model import ModelLoader
from image_processor import ImageProcessor
from benchmark import Benchmark

# Configure logging
logging.basicConfig(filename="model.log", level=logging.INFO)


def run_benchmark(model: torch.nn.Module, device: str, dtype: torch.dtype) -> None:
    """
    Run and log the benchmark for the given model, device, and dtype.

    :param model: The model to be benchmarked.
    :param device: The device to run the benchmark on ("cpu" or "cuda").
    :param dtype: The data type to be used in the benchmark (typically torch.float32 or torch.float16).
    """
    logging.info(f"Running Benchmark for {device.upper()}")
    benchmark = Benchmark(model, device=device, dtype=dtype)
    benchmark.run()


def make_prediction(
    model: torch.nn.Module,
    img_batch: torch.Tensor,
    topk: int,
    categories: List[str],
    precision: torch.dtype,
) -> None:
    """
    Make and print predictions for the given model, img_batch, topk, and categories.

    :param model: The model to make predictions with.
    :param img_batch: The batch of images to make predictions on.
    :param topk: The number of top predictions to show.
    :param categories: The list of categories to label the predictions.
    :param precision: The data type to be used for the predictions (typically torch.float32 or torch.float16).
    """
    model.eval()
    with torch.no_grad():
        outputs = model(img_batch.to(precision))
    prob = torch.nn.functional.softmax(outputs[0], dim=0)

    probs, classes = torch.topk(prob, topk)
    for i in range(topk):
        probability = probs[i].item()
        class_label = categories[0][int(classes[i])]
        print(f"%{int(probability * 100)} {class_label}")


def main() -> None:
    """
    Main function to run inference, benchmarks, and predictions on the model
    using provided image and optional parameters.
    """
    # Initialize ArgumentParser with description
    parser = argparse.ArgumentParser(description="PyTorch Inference")
    parser.add_argument(
        "--image_path",
        type=str,
        required=True,
        default="./inference/cat3.jpg",
        help="Path to the image to predict",
    )
    parser.add_argument(
        "--topk", type=int, default=1, help="Number of top predictions to show"
    )
    args = parser.parse_args()

    # Setup device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Initialize model and image processor
    model_loader = ModelLoader(device=device)
    img_processor = ImageProcessor(img_path=args.image_path, device=device)
    img_batch = img_processor.process_image()

    # Run benchmarks for CPU and CUDA
    run_benchmark(model_loader.model.to("cpu"), "cpu", torch.float32)
    run_benchmark(model_loader.model.to("cuda"), "cuda", torch.float32)

    # Trace CUDA model
    print("Tracing CUDA model")
    traced_model = torch.jit.trace(
        model_loader.model, [torch.randn((1, 3, 224, 224)).to("cuda")]
    )

    # Compile, run benchmarks and make predictions with TensorRT models
    for precision in [torch.float32, torch.float16]:
        logging.info(
            f"Compiling and Running Inference Benchmark for TensorRT with precision: {precision}"
        )
        trt_model = torch_tensorrt.compile(
            traced_model,
            inputs=[torch_tensorrt.Input((32, 3, 224, 224), dtype=precision)],
            enabled_precisions={precision},
        )
        run_benchmark(trt_model, "cuda", precision)
        print("Making prediction with TensorRT model")
        make_prediction(
            trt_model, img_batch, args.topk, model_loader.categories, precision
        )


if __name__ == "__main__":
    main()
