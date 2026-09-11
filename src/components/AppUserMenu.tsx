import { Avatar, Box, Typography } from '@mui/material';

const USER_NAME = 'Marvik Team';
const USER_INITIALS = 'MT';

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
    </Box>
  );
}
