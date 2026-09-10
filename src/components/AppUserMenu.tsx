import { Avatar, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const USER_NAME = 'Jane Doe';
const USER_INITIALS = 'JD';

export default function AppUserMenu() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Avatar
        sx={{ width: 28, height: 28, bgcolor: 'info.main', fontSize: 12, fontWeight: 700 }}
      >
        {USER_INITIALS}
      </Avatar>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {USER_NAME}
      </Typography>
      <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
    </Box>
  );
}
