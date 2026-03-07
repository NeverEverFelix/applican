import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Modal from "@mui/material/Modal";
import logoIcon from "../../assets/logo.png";

type AppModalProps = {
  open: boolean;
  onClose: () => void;
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 520,
  maxWidth: "calc(100vw - 32px)",
  minHeight: 260,
  borderRadius: "16px",
  backgroundColor: "#101010",
  border: "1px solid #2a2a2a",
  boxShadow: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

export default function AppModal({ open, onClose }: AppModalProps) {
  return (
    <Modal
      aria-label="Upgrade modal"
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 180 } }}
    >
      <Fade in={open}>
        <Box sx={modalStyle}>
          <Box
            component="img"
            src={logoIcon}
            alt="Applican logo"
            sx={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 28,
              height: 28,
              objectFit: "contain",
            }}
          />
          <Box
            component="h2"
            sx={{
              width: "calc(100% - 72px)",
              margin: 0,
              textAlign: "center",
              boxSizing: "border-box",
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 400,
              lineHeight: "25px",
            }}
          >
            You must be subscribed to Applican Pro to access this resource
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}
