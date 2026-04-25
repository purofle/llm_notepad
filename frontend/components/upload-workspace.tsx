'use client';

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import type Cropper from 'cropperjs';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import { invalidateProblemsCache } from '@/lib/problems-api';
import { invalidateReviewRecommendationCache } from '@/lib/review-api';
import type { Problem, UploadApiResponse } from '@/lib/types';

type UploadState = {
  rawResult: string;
  responseId: string;
  parsedProblem: Problem | null;
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

function normalizeProblem(problem: Problem | null | undefined) {
  if (!problem || !Array.isArray(problem.tags)) {
    return null;
  }

  return {
    content: problem.content.trim(),
    type: problem.type.trim(),
    subject: problem.subject.trim(),
    answer: problem.answer.trim(),
    tags: problem.tags.map((tag) => String(tag).trim()).filter(Boolean),
  } satisfies Problem;
}

export function UploadWorkspace() {
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

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const clipboardItems = event.clipboardData?.items;

      if (!clipboardItems || clipboardItems.length === 0) {
        return;
      }

      for (const item of clipboardItems) {
        if (!item.type.startsWith('image/')) {
          continue;
        }

        const file = item.getAsFile();

        if (!file) {
          continue;
        }

        event.preventDefault();
        resetSource(
          URL.createObjectURL(file),
          file.name || `pasted-image-${Date.now()}.png`,
        );
        setMessage('已粘贴图片，调整裁剪区域后点击上传');
        return;
      }
    }

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
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
      const { data: result } = await axios.post<UploadApiResponse>(
        UPLOAD_ENDPOINT,
        {
          dataUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const parsedProblem = normalizeProblem(result.problem);
      const nextUploadState = {
        rawResult: typeof result.result === 'string' ? result.result : '',
        responseId: typeof result.response_id === 'string' ? result.response_id : '',
        parsedProblem,
      } satisfies UploadState;

      invalidateReviewRecommendationCache();
      invalidateProblemsCache();
      resetSource(URL.createObjectURL(file), file.name, nextUploadState);
      setMessage(
        parsedProblem
          ? '图片已识别并加入错题列表'
          : '图片已发送到后端，但返回结果缺少可用的 problem 字段',
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail =
          typeof error.response?.data?.detail === 'string'
            ? error.response.data.detail
            : typeof error.response?.data?.error === 'string'
              ? error.response.data.error
              : '';
        setMessage(
          detail || (error.response?.status ? `上传失败 (${error.response.status})` : '上传失败'),
        );
        return;
      }

      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppShell title="赛博错题本" description="都什么时代了，还在写传统错题本？">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div
          className="rounded-4xl p-5 md:p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          <div className="flex flex-wrap gap-3">
            <label
              htmlFor="photo-input"
              className="relative inline-flex rounded-full px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                cursor: isUploading ? 'not-allowed' : 'pointer',
                backgroundColor: isUploading ? 'var(--surface-strong)' : 'var(--primary)',
                color: 'var(--primary-ink)',
              }}
            >
              <span>{sourceImageUrl ? '重新拍照/选图' : '选择图片'}</span>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 h-full w-full opacity-0"
                disabled={isUploading}
                aria-label={sourceImageUrl ? '重新拍照或选择图片' : '选择图片'}
                onChange={handleFileChange}
              />
            </label>

            <button
              type="button"
              className="rounded-full px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              style={{
                backgroundColor:
                  isUploading || !sourceImageUrl || !imageLoaded
                    ? 'var(--surface-strong)'
                    : 'var(--primary-deep)',
                color:
                  isUploading || !sourceImageUrl || !imageLoaded
                    ? 'var(--muted)'
                    : '#fff8f8',
              }}
              onClick={handleUpload}
              disabled={!sourceImageUrl || !imageLoaded || isUploading}
            >
              {isUploading ? '上传中...' : '上传并识别'}
            </button>
          </div>

          <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            {message}
          </p>
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>
            也可以直接按{' '}
            <kbd
              className="rounded px-1.5 py-0.5"
              style={{ backgroundColor: 'var(--surface-soft)' }}
            >
              Ctrl
            </kbd>
            +
            <kbd
              className="rounded px-1.5 py-0.5"
              style={{ backgroundColor: 'var(--surface-soft)' }}
            >
              V
            </kbd>
            粘贴截图。
          </p>

          {sourceImageUrl ? (
            <section className="mt-6 space-y-3">
              <h2 className="text-sm font-medium" style={{ color: 'var(--primary-ink)' }}>
                裁剪区域
              </h2>
              <div
                className="cropper-shell overflow-hidden rounded-3xl p-4"
                style={{
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--surface-soft)',
                }}
              >
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
            </section>
          ) : (
            <div
              className="mt-6 flex min-h-72 items-center justify-center rounded-3xl border border-dashed text-center text-sm leading-6"
              style={{
                borderColor: 'var(--line)',
                backgroundColor: 'var(--surface-soft)',
                color: 'var(--muted)',
              }}
            >
              先选择一张错题图片，再调整裁剪区域。
            </div>
          )}
        </div>

        <aside
          className="rounded-4xl p-5 md:p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface-soft)',
            color: 'var(--foreground)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase">
                Parsed Result
              </p>
              <h2 className="mt-2 text-2xl font-semibold">本次识别结果</h2>
            </div>

            {uploadState?.parsedProblem ? (
              <div className="space-y-4">
                <div
                  className="rounded-3xl p-4"
                  style={{ backgroundColor: 'var(--surface)' }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    题目内容
                  </p>
                  <MathText
                    text={uploadState.parsedProblem.content}
                    className="mt-2 text-sm leading-7"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-3xl p-4"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      学科
                    </p>
                    <p className="mt-2 text-sm">{uploadState.parsedProblem.subject}</p>
                  </div>
                  <div
                    className="rounded-3xl p-4"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      题型
                    </p>
                    <p className="mt-2 text-sm">{uploadState.parsedProblem.type}</p>
                  </div>
                </div>

                <div
                  className="rounded-3xl p-4"
                  style={{ backgroundColor: 'var(--surface)' }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    答案
                  </p>
                  <MathText
                    text={uploadState.parsedProblem.answer}
                    className="mt-2 text-sm leading-7"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {uploadState.parsedProblem.tags.length > 0 ? (
                    uploadState.parsedProblem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: 'var(--surface-strong)',
                          color: 'var(--primary-ink)',
                        }}
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>
                      暂无知识点标签
                    </span>
                  )}
                </div>

                {uploadState.responseId ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Response ID: {uploadState.responseId}
                  </p>
                ) : null}
              </div>
            ) : uploadState?.rawResult ? (
              <div
                className="rounded-3xl p-4 text-sm whitespace-pre-wrap"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                {uploadState.rawResult}
              </div>
            ) : (
              <div
                className="rounded-3xl p-4 text-sm leading-6"
                style={{
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--muted)',
                }}
              >
                还没识别内容。
              </div>
            )}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
