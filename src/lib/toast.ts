import { toast, type ToastOptions } from "react-toastify";

const base: ToastOptions = {
  position: "top-right",
  autoClose: 3200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
};

export function toastSuccess(message: string, opts?: ToastOptions) {
  toast.success(message, { ...base, ...opts });
}

export function toastError(message: string, opts?: ToastOptions) {
  toast.error(message, { ...base, ...opts });
}

export function toastInfo(message: string, opts?: ToastOptions) {
  toast.info(message, { ...base, ...opts });
}

export function toastWarning(message: string, opts?: ToastOptions) {
  toast.warning(message, { ...base, ...opts });
}
