"use client";

type Props = {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
};

export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}