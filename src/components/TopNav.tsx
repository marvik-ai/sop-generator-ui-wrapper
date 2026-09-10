import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AppUserMenu from './AppUserMenu';

const APP_NAME = 'SOP Generator';

export default function TopNav() {
  return (
    <AppBar
      position="static"
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DescriptionIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {APP_NAME}
        </Typography>
        <AppUserMenu />
      </Toolbar>
    </AppBar>
  );
}
