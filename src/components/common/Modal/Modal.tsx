import './Modal.scss';

interface ModalProps {
  opened: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ opened, onClose, children, className }: ModalProps) {
  if (!opened) return null;

  return (
    <>
      <div className={`modal__backdrop${className ? ` ${className}__backdrop` : ''}`} onClick={onClose} />
      <div className={`modal${className ? ` ${className}` : ''}`}>
        <div className="modal__handle" />
        <div className="modal__content">{children}</div>
      </div>
    </>
  );
}
