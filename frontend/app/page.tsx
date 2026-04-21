'use client';

import { useEffect, useRef, useState } from 'react';
import type Cropper from 'cropperjs';

type UploadState = {
  result: string;
  responseId: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.2.3:8000';
const UPLOAD_ENDPOINT = `${API_BASE_URL}/uploads`;
const CROPPER_TEMPLATE = `
  <cropper-canvas background>
    <cropper-image rotatable scalable skewable translatable></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection initial-coverage="0.7" movable resizable>
      <cropper-grid role="grid" bordered covered></cropper-grid>
      <cropper-crosshair centered></cropper-crosshair>
      <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`;

async function canvasToImageFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  type: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.98,
) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        reject(new Error('裁剪结果生成失败'));
      },
      type,
      quality,
    );
  });

  return new File([blob], fileName, { type });
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('图片编码失败'));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('图片编码失败'));
    };

    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const imageMetricsRef = useRef({
    naturalWidth: 0,
    naturalHeight: 0,
    renderedWidth: 0,
    renderedHeight: 0,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('在此处上传图片');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [baseFileName, setBaseFileName] = useState('photo');

  useEffect(() => {
    return () => {
      cropperRef.current?.destroy();

      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current);
      }
    };
  }, []);

  function resetSource(
    url: string,
    fileName: string,
    nextUploadState: UploadState | null = null,
  ) {
    cropperRef.current?.destroy();

    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
    }

    sourceUrlRef.current = url;
    setSourceImageUrl(url);
    setBaseFileName(fileName.replace(/\.[^.]+$/, '') || 'photo');
    setImageLoaded(false);
    setUploadState(nextUploadState);
    imageMetricsRef.current = {
      naturalWidth: 0,
      naturalHeight: 0,
      renderedWidth: 0,
      renderedHeight: 0,
    };
    setMessage('调整裁剪区域后点击上传');
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith('image/')) {
      setMessage('请选择图片文件');
      event.target.value = '';
      return;
    }

    resetSource(URL.createObjectURL(file), file.name || 'photo.jpg');
    event.target.value = '';
  }

  useEffect(() => {
    if (!sourceImageUrl || !imageLoaded || !imageRef.current) {
      return;
    }

    let disposed = false;

    async function initCropper() {
      const { default: CropperConstructor } = await import('cropperjs');

      if (disposed || !imageRef.current) {
        return;
      }

      cropperRef.current?.destroy();
      cropperRef.current = new CropperConstructor(imageRef.current, {
        container: imageRef.current.parentElement ?? undefined,
        template: CROPPER_TEMPLATE,
      });
    }

    initCropper().catch((error) => {
      setMessage(error instanceof Error ? error.message : '裁剪组件初始化失败');
    });

    return () => {
      disposed = true;
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [imageLoaded, sourceImageUrl]);

  async function handleUpload() {
    const cropperSelection = cropperRef.current?.getCropperSelection();
    const {
      naturalWidth,
      naturalHeight,
      renderedWidth,
      renderedHeight,
    } = imageMetricsRef.current;

    if (!cropperSelection || !naturalWidth || !naturalHeight) {
      setMessage('图片还没准备好，请重新拍照');
      return;
    }

    setIsUploading(true);
    setMessage('正在生成裁剪图片并上传...');

    try {
      const scaleX = renderedWidth > 0 ? naturalWidth / renderedWidth : 1;
      const scaleY = renderedHeight > 0 ? naturalHeight / renderedHeight : 1;
      const exportWidth = Math.max(1, Math.round(cropperSelection.width * scaleX));
      const exportHeight = Math.max(
        1,
        Math.round(cropperSelection.height * scaleY),
      );
      const canvas = await cropperSelection.$toCanvas({
        width: exportWidth,
        height: exportHeight,
      });
      const file = await canvasToImageFile(
        canvas,
        `${baseFileName}.png`,
        'image/png',
      );
      const dataUrl = await fileToDataUrl(file);

      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataUrl,
        }),
      });

      let result: Record<string, unknown> | null = null;
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        result = (await response.json()) as Record<string, unknown>;
      }

      if (!response.ok || result == null) {
        const errorMessage =
          typeof result?.detail === 'string'
            ? result.detail
            : typeof result?.error === 'string'
              ? result.error
            : `上传失败 (${response.status})`;

        throw new Error(errorMessage);
      }

      const extractedResult =
        typeof result?.result === 'string' ? result.result : '';
      const responseId =
        typeof result?.response_id === 'string' ? result.response_id : '';

      const nextUploadState = {
        result: extractedResult,
        responseId,
      };

      resetSource(URL.createObjectURL(file), file.name, nextUploadState);
      setMessage('图片已发送到后端并完成信息提取');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">赛博错题本</h1>
          <p className="text-sm text-zinc-600">{message}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label
            htmlFor="photo-input"
            className={`relative inline-flex rounded-lg bg-amber-300 px-5 py-3 font-semibold text-black transition ${
              isUploading
                ? 'cursor-not-allowed bg-amber-200'
                : 'cursor-pointer hover:bg-amber-400'
            }`}
          >
            <span>{sourceImageUrl ? '重新拍照/选图' : '选择图片'}</span>
            <input
              id="photo-input"
              type="file"
              accept="image/*,text/plain"
              capture="environment"
              className="absolute inset-0 h-full w-full opacity-0"
              disabled={isUploading}
              aria-label={sourceImageUrl ? '重新拍照或选择图片' : '选择图片'}
              onChange={handleFileChange}
            />
          </label>

          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            onClick={handleUpload}
            disabled={!sourceImageUrl || !imageLoaded || isUploading}
          >
            {isUploading ? '上传中...' : '上传'}
          </button>
        </div>

        {sourceImageUrl ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-700">裁剪区域</h2>
            <div className="cropper-shell overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={sourceImageUrl}
                ref={imageRef}
                src={sourceImageUrl}
                alt="待裁剪图片"
                className="block max-w-full"
                onLoad={(event) => {
                  const img = event.currentTarget;

                  imageMetricsRef.current = {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    renderedWidth: img.getBoundingClientRect().width,
                    renderedHeight: img.getBoundingClientRect().height,
                  };
                  setImageLoaded(true);
                }}
                onError={() => {
                  setImageLoaded(false);
                  setMessage('图片无法加载，请重新拍照或选图');
                }}
              />
            </div>

            {uploadState ? (
              <>
                {uploadState.result ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm whitespace-pre-wrap text-zinc-800">
                    {uploadState.result}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">后端未返回提取结果</p>
                )}
                {uploadState.responseId ? (
                  <p className="text-xs text-zinc-500">
                    Response ID: {uploadState.responseId}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
