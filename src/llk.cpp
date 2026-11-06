#include "llk.h"
#include "math.h"
#include <graphics.h>
#include <stdio.h>
#include <time.h>
#include <conio.h>
#include <windows.h>
#include <mmsystem.h>			// for PlaySound() / mciSendString() 函数
#pragma comment (lib, "winmm.lib")
#define Len_Image 100//正方形图片边长
IMAGE img[27];//存储图库

int xt[2], yt[2];//存储点击位置
int presscount = 0;//存储点击次数
int remaining = MapSize * MapSize;//剩余字母数
int kb_key;//键盘输入
int resist_time = 30 * MapSize;//游戏剩余时间
int helpcount = MapSize/2;//提示的次数
int guan_count = 1;//当前关卡数
int pause_flag = 0;//置为1说明游戏暂停 不计时
char element[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#";//地图中的元素（字母）
char Map[MapSize + 2][MapSize + 2] = { 0 };//字母前后要各有1个位置空白处用来走线

LRESULT CALLBACK CBTHookProc(int nCode, WPARAM wParam, LPARAM lParam)
{
	HWND hwnd = (HWND)wParam;
	if (nCode == HCBT_ACTIVATE)
	{
		if (nCode == HCBT_ACTIVATE)
		{
			SetDlgItemTextA((HWND)wParam, IDYES, "&直接开始");
			SetDlgItemTextA((HWND)wParam, IDNO, "&读档开始");
			SetDlgItemTextA((HWND)wParam, IDOK, "&OK");
			SetDlgItemTextA((HWND)wParam, IDCANCEL, "&Cancel");
			SetDlgItemTextA((HWND)wParam, IDABORT, "&ABORT");
			SetDlgItemTextA((HWND)wParam, IDRETRY, "&RETRY");
			SetDlgItemTextA((HWND)wParam, IDIGNORE, "&IGNORE");

		}
	}
	return 0;
}

int Msg(HWND hwnd, const char *szText, const char *szCaption, UINT uType)
{
	int ret;
	HHOOK hHook = SetWindowsHookEx(
		WH_CBT,
		CBTHookProc,
		NULL,
		GetCurrentThreadId()
		);
	ret = MessageBoxA(hwnd, szText, szCaption, uType);
	UnhookWindowsHookEx(hHook);
	return ret;
}

//判断三条线能否消除
int Line(int start[2], int end[2])
{
	int i;
	if (start[0] == end[0])
	{
		if (start[1] > end[1])
		{
			for (i = start[1] - 1; i > end[1]; i--)
				if (Map[start[0]][i] != 0)
					return 0;
			return 1;
		}
		else
		{
			for (i = start[1] + 1; i < end[1]; i++)
				if (Map[start[0]][i] != 0)
					return 0;
			return 1;
		}
	}
	else if (start[1] == end[1])
	{
		if (start[0] > end[0])
		{
			for (i = start[0] - 1; i > end[0]; i--)
				if (Map[i][start[1]] != 0)
					return 0;
			return 1;
		}
		else
		{
			for (i = start[0] + 1; i < end[0]; i++)
				if (Map[i][start[1]] != 0)
					return 0;
			return 1;
		}
	}
	return 0;
}
int TwoLines(int start[2], int end[2])
{
	if (Line(start, end) == 1)
		return 1;

	int p1[2], p2[2];
	p1[0] = start[0];
	p1[1] = end[1];
	p2[0] = end[0];
	p2[1] = start[1];

	if (Map[p1[0]][p1[1]] == 0 && Line(start, p1) && Line(end, p1))
		return 1;
	if (Map[p2[0]][p2[1]] == 0 && Line(start, p2) && Line(end, p2))
		return 1;

	return 0;
}
int TreeLines(int start[2], int end[2])
{
	if (
		Map[start[0]][start[1]] == Map[end[0]][end[1]]
		&& (!(start[0] == end[0] && start[1] == end[1]))
		)
	{//先后点击的start end字母相同且不是同一个位置
		if (TwoLines(start, end))
			return 1;

		int i, mid[2];
		for (i = start[0] - 1; i >= 0; i--)
		{
			if (Map[i][start[1]] != 0) break;
			mid[0] = i;
			mid[1] = start[1];
			if (TwoLines(mid, end)) return 1;
		}
		for (i = start[0] + 1; i <= MapSize + 1; i++)
		{
			if (Map[i][start[1]] != 0) break;
			mid[0] = i;
			mid[1] = start[1];
			if (TwoLines(mid, end)) return 1;
		}
		for (i = start[1] - 1; i >= 0; i--)
		{
			if (Map[start[0]][i] != 0) break;
			mid[0] = start[0];
			mid[1] = i;
			if (TwoLines(mid, end)) return 1;
		}
		for (i = start[1] + 1; i <= MapSize + 1; i++)
		{
			if (Map[start[0]][i] != 0) break;
			mid[0] = start[0];
			mid[1] = i;
			if (TwoLines(mid, end)) return 1;
		}
	}

	return 0;
}
//可以消除时画消除路径
int DrawLine(int start[2], int end[2])
{
	int i;
	if (start[0] == end[0])
	{
		if (start[1] > end[1])
		{
			for (i = start[1] - 1; i > end[1]; i--)
				if (Map[start[0]][i] != 0)
					return 0;
			line(start[0] * 100 + 50, start[1] * 100 + 50, end[0] * 100 + 50, end[1] * 100 + 50);
			return 1;
		}
		else
		{
			for (i = start[1] + 1; i < end[1]; i++)
				if (Map[start[0]][i] != 0)
					return 0;
			line(start[0] * 100 + 50, start[1] * 100 + 50, end[0] * 100 + 50, end[1] * 100 + 50);
			return 1;
		}
	}
	else if (start[1] == end[1])
	{
		if (start[0] > end[0])
		{
			for (i = start[0] - 1; i > end[0]; i--)
				if (Map[i][start[1]] != 0)
					return 0;
			line(start[0] * 100 + 50, start[1] * 100 + 50, end[0] * 100 + 50, end[1] * 100 + 50);

			return 1;
		}
		else
		{
			for (i = start[0] + 1; i < end[0]; i++)
				if (Map[i][start[1]] != 0)
					return 0;
			line(start[0] * 100 + 50, start[1] * 100 + 50, end[0] * 100 + 50, end[1] * 100 + 50);

			return 1;
		}
	}
	return 0;
}
int DrawTwoLines(int start[2], int end[2])
{
	if (DrawLine(start, end) == 1)
		return 1;

	int p1[2], p2[2];
	p1[0] = start[0];
	p1[1] = end[1];
	p2[0] = end[0];
	p2[1] = start[1];

	if (Map[p1[0]][p1[1]] == 0 && Line(start, p1) && Line(end, p1))
	{
		DrawLine(start, p1);
		DrawLine(end, p1);
		return 1;
	}
	if (Map[p2[0]][p2[1]] == 0 && Line(start, p2) && Line(end, p2))
	{
		DrawLine(start, p2);
		DrawLine(end, p2);
		return 1;
	}
	return 0;
}
int DrawTreeLines(int start[2], int end[2])
{
	if (
		Map[start[0]][start[1]] == Map[end[0]][end[1]]
		&& (!(start[0] == end[0] && start[1] == end[1]))
		)
	{//先后点击的start end字母相同且不是同一个位置
		if (DrawTwoLines(start, end))
			return 1;

		int i, mid[2];
		for (i = start[0] - 1; i >= 0; i--)
		{
			if (Map[i][start[1]] != 0) break;
			mid[0] = i;
			mid[1] = start[1];
			if (DrawTwoLines(mid, end))
			{
				DrawLine(mid, start);
				return 1;
			}
		}
		for (i = start[0] + 1; i <= MapSize + 1; i++)
		{
			if (Map[i][start[1]] != 0) break;
			mid[0] = i;
			mid[1] = start[1];
			if (DrawTwoLines(mid, end))
			{
				DrawLine(mid, start);
				return 1;
			}
		}
		for (i = start[1] - 1; i >= 0; i--)
		{
			if (Map[start[0]][i] != 0) break;
			mid[0] = start[0];
			mid[1] = i;
			if (DrawTwoLines(mid, end))
			{
				DrawLine(mid, start);
				return 1;
			}
		}
		for (i = start[1] + 1; i <= MapSize + 1; i++)
		{
			if (Map[start[0]][i] != 0) break;
			mid[0] = start[0];
			mid[1] = i;
			if (DrawTwoLines(mid, end))
			{
				DrawLine(mid, start);
				return 1;
			}
		}
	}

	return 0;
}

//初始化 生成并显示地图
void Oninit_all()
{
    helpcount = MapSize / 2;
	xt[0] = 0;//清空点击位置
	xt[1] = 0;//清空点击位置
	yt[0] = 0;//清空点击位置
	yt[1] = 0;//清空点击位置
	presscount = 0;//清空点击次数
	remaining = MapSize * MapSize;//加满剩余字母数

	for (int i = 0; i < MapSize + 2; i++)//清空地图
		for (int j = 0; j < MapSize + 2; j++)
			Map[i][j] = 0;

	resist_time = 30 * MapSize - (guan_count - 1) * 5;//恢复剩余时间
	if (resist_time <= 30)
		resist_time = 30;
}
void CreateMap()
{
    // Keep the original 18 active portraits, but generate complete pairs.
    char values[MapSize * MapSize];
    for (int i = 0; i < MapSize * MapSize / 2; ++i)
        values[i*2] = values[i*2+1] = element[i % 18];
    for (int i = MapSize * MapSize - 1; i > 0; --i)
        std::swap(values[i], values[rand() % (i+1)]);
    for (int i = 0; i < MapSize * MapSize; ++i)
        Map[i % MapSize + 1][i / MapSize + 1] = values[i];
}
void ShowMap()//显示地图
{
	cleardevice();//清空
	putimage(0, 0, &img[26]);//显示背景
	pause_flag = 0;//刷新地图时时间不暂停
	for (int i = 1; i < MapSize + 1; i++)
		for (int j = 1; j < MapSize + 1; j++)
			if (Map[i][j] != 0 && Map[i][j] != '*')
			{
				int num = strlen(element) - strlen(strchr(element, Map[i][j]));
				putimage(i * Len_Image, j * Len_Image, &img[num]);
			}
    DrawStatus();
}
void xipai()
{
    char values[MapSize * MapSize];
    int n = 0;
    for (int y = 1; y <= MapSize; ++y)
        for (int x = 1; x <= MapSize; ++x)
            if (Map[x][y]) values[n++] = Map[x][y];
    for (int i = n-1; i > 0; --i) std::swap(values[i], values[rand() % (i+1)]);
    n = 0;
    for (int y = 1; y <= MapSize; ++y)
        for (int x = 1; x <= MapSize; ++x)
            if (Map[x][y]) Map[x][y] = values[n++];
}
void MoveDir(int Dir)
{
	switch (Dir)
	{
	case 2://左
		for (int i = 2; i < MapSize + 1; i++)
			for (int j = 1; j < MapSize + 1; j++)
				if (Map[i - 1][j] == 0)//左面的为空
				{
					Map[i - 1][j] = Map[i][j];
					Map[i][j] = 0;
				}
		break;
	case 3://右
		for (int i = MapSize - 1; i > 0; i--)
			for (int j = 1; j < MapSize + 1; j++)
				if (Map[i + 1][j] == 0) //右面的为空
				{
					Map[i + 1][j] = Map[i][j];
					Map[i][j] = 0;
				}
		break;
	case 4://上
		for (int i = 1; i < MapSize + 1; i++)
			for (int j = 2; j < MapSize + 1; j++)
				if (Map[i][j - 1] == 0)//上面的为空
				{
					Map[i][j - 1] = Map[i][j];
					Map[i][j] = 0;
				}
		break;
	case 5://下
		for (int i = 1; i < MapSize + 1; i++)
			for (int j = MapSize - 1; j > 0; j--)
				if (Map[i][j + 1] == 0)//下面的为空
				{
					Map[i][j + 1] = Map[i][j];
					Map[i][j] = 0;
				}
		break;
	}
}
void MoveMap()//移动地图
{
	if (guan_count > 1)
	{
		for (int i = 1; i < MapSize - 1; i++)
			switch (guan_count)
			{
			case 2://左
				MoveDir(2);
				break;
			case 3://右
				MoveDir(3);
				break;
			case 4://上
				MoveDir(4);
				break;
			case 5://下
				MoveDir(5);
				break;
			case 6://左上
				MoveDir(2);
				MoveDir(4);
				break;
			case 7://右上
				MoveDir(3);
				MoveDir(4);
				break;
			case 8://左下
				MoveDir(2);
				MoveDir(5);
				break;
			case 9://右下
				MoveDir(3);
				MoveDir(5);
				break;
			default://其余情况左下
				MoveDir(2);
				MoveDir(5);
				break;
			}
	}
}
void DrawStatus()
{
    int oldRop = getrop2();
    setrop2(R2_COPYPEN);
    setfillcolor(RGB(22, 27, 35));
    solidrectangle(0, 0, 1020, 94);
    setbkmode(TRANSPARENT);
    settextcolor(RGB(235, 240, 247));
    settextstyle(26, 0, L"Microsoft YaHei");
    outtextxy(100, 12, L"连连看");
    wchar_t status[160];
    swprintf(status, 160, L"第 %d 关    剩余 %d 对    时间 %02d:%02d    提示 %d 次", guan_count, remaining / 2, resist_time / 60, resist_time % 60, helpcount);
    settextstyle(19, 0, L"Microsoft YaHei");
    settextcolor(RGB(158, 192, 228));
    outtextxy(100, 53, status);
    settextcolor(RGB(155, 164, 181));
    outtextxy(100, 925, L"空格：提示    Tab：自动消除    Esc：存档       相同头像，最多拐两次弯");
    setfillcolor(BLUE);
    settextcolor(WHITE);
    setrop2(oldRop);
}

void Show_time(void *)
{
    // Main-loop timer: all drawing now happens on the same thread.
    static ULONGLONG last = GetTickCount64();
    ULONGLONG now = GetTickCount64();
    if (now - last < 1000) return;
    int elapsed = static_cast<int>((now-last)/1000);
    last += elapsed * 1000;
    if (!pause_flag) resist_time = (std::max)(0, resist_time-elapsed);
    DrawStatus();
}
//游戏操作和判断结果
void Save_game()//存档
{
	// fopen wb replaces the existing save without a shell command.
	FILE  *mem;
	if ((mem = fopen("memory.txt", "wb")) == NULL)//创建失败则继续游戏
	{
		MessageBoxA(0, "存档失败", "连连看", MB_OK | MB_SYSTEMMODAL);
		pause_flag = 1 - pause_flag;//游戏继续
	}
	else
	{
		//保存点击位置
		fwrite(&xt[0], sizeof(xt[0]), 1, mem);
		fwrite(&xt[1], sizeof(xt[1]), 1, mem);
		fwrite(&yt[0], sizeof(yt[0]), 1, mem);
		fwrite(&yt[1], sizeof(yt[1]), 1, mem);
		//保存点击次数
		fwrite(&presscount, sizeof(presscount), 1, mem);
		//保存剩余图片数
		fwrite(&remaining, sizeof(remaining), 1, mem);
		//保存剩余时间
		fwrite(&resist_time, sizeof(resist_time), 1, mem);
		//保存剩余求助次数
		fwrite(&helpcount, sizeof(helpcount), 1, mem);
		//保存关卡数
		fwrite(&guan_count, sizeof(guan_count), 1, mem);
		//保存地图
		for (int i = 0; i < MapSize + 2; i++)
			for (int j = 0; j < MapSize + 2; j++)
				fwrite(&Map[i][j], sizeof(Map[i][j]), 1, mem);

		fclose(mem);
		int memres = MessageBoxA(0, "存档完成，是否退出", "连连看", MB_OKCANCEL | MB_SYSTEMMODAL);
		if (memres == IDOK)//选择确定
		{
			closegraph();
			exit(0);
		}
		else if (memres == IDCANCEL)
			pause_flag = 1 - pause_flag;//游戏继续
	}
}
void Read_game()
{
    FILE *mem = fopen("memory.txt", "rb");
    int values[9]; char cells[MapSize+2][MapSize+2];
    bool valid = mem && fread(values, sizeof(int), 9, mem) == 9 &&
        fread(cells, sizeof(cells), 1, mem) == 1 && fgetc(mem) == EOF;
    if (mem) fclose(mem);
    int count = 0, counts[26] = {0};
    if (valid) {
        for (int x=0;x<MapSize+2;++x) for (int y=0;y<MapSize+2;++y) {
            char c=cells[x][y];
            if (x==0 || y==0 || x==MapSize+1 || y==MapSize+1) { if(c) valid=false; }
            else if(c) { if(c<'A' || c>'Y') valid=false; else {++counts[c-'A']; ++count;} }
        }
        for(int i=0;i<26;++i) if(counts[i]%2) valid=false;
        valid = valid && count>0 && count==values[5] && values[6]>0 && values[6]<=240 && values[7]>=0 && values[7]<=4 && values[8]>=1 && values[8]<=100000;
    }
    if (!valid) {
        MessageBoxA(GetHWnd(), "没有可用存档（或旧存档格式不兼容），将开始新游戏。", "连连看", MB_OK);
        guan_count=1; Oninit_all(); CreateMap(); return;
    }
    xt[0]=xt[1]=yt[0]=yt[1]=presscount=0;
    remaining=values[5]; resist_time=values[6]; helpcount=values[7]; guan_count=values[8];
    memcpy(Map,cells,sizeof(Map));
}
int Modify_XY(double pos)//修正鼠标位置到图片中心
{
	return (int)(pos / Len_Image ) * Len_Image + Len_Image / 2;
}
void Get_Mouse()//获取鼠标事件
{
	if (MouseHit())
	{
		MOUSEMSG msg = GetMouseMsg();
		switch (msg.uMsg)
		{
		case WM_LBUTTONDOWN://左键按下
			int loc_BUTTONDOWN[2] = {(Modify_XY(msg.x) - Len_Image / 2) / Len_Image, (Modify_XY(msg.y) - Len_Image / 2) / Len_Image };//重新保存下标

			if (loc_BUTTONDOWN[0] >= 1 && loc_BUTTONDOWN[0] <= MapSize &&
                loc_BUTTONDOWN[1] >= 1 && loc_BUTTONDOWN[1] <= MapSize &&
                Map[loc_BUTTONDOWN[0]][loc_BUTTONDOWN[1]] != 0)//所点击的位置不为空
			{
				rectangle(
					Modify_XY(msg.x) - Len_Image / 2,
					Modify_XY(msg.y) - Len_Image / 2,
					Modify_XY(msg.x) + Len_Image / 2,
					Modify_XY(msg.y) + Len_Image / 2);
				Sleep(30);//等待 屏幕显示
				presscount++;//计点击次数
				xt[presscount - 1] = Modify_XY(msg.x);//存储坐标
				yt[presscount - 1] = Modify_XY(msg.y);
				if (presscount == 2)//每点击两次 消除
				{
					for (int i = 0; i < 2;i++)
						rectangle(
						xt[i] - Len_Image / 2,
						yt[i] - Len_Image / 2,
						xt[i] + Len_Image / 2,
						yt[i] + Len_Image / 2);
					presscount = 0;//重新计点击次数
					delete_or_not(xt, yt);

				}
			}
			break;
		}
	}
}
void get_kbeve()
{
    // Capture key edges in the graphics window; no console focus required.
    static bool wasSpace=false, wasTab=false, wasEsc=false;
    if(GetForegroundWindow()!=GetHWnd()) { wasSpace=wasTab=wasEsc=false; return; }
    bool space=(GetAsyncKeyState(VK_SPACE)&0x8000)!=0;
    bool tab=(GetAsyncKeyState(VK_TAB)&0x8000)!=0;
    bool esc=(GetAsyncKeyState(VK_ESCAPE)&0x8000)!=0;
    if(esc && !wasEsc) {
        pause_flag=1;
        if(MessageBoxA(GetHWnd(),"请选择是否存档","连连看",MB_OKCANCEL)==IDOK) Save_game();
        pause_flag=0; Show_time(NULL);
    }
    if(space && !wasSpace && helpcount>0 && Find_step_onexit()) { Show_helpstep(32); --helpcount; }
    if(tab && !wasTab) while(remaining>0 && resist_time>0 && Find_step_onexit()) { Show_helpstep(9); Show_time(NULL); }
    wasSpace=space; wasTab=tab; wasEsc=esc;
}
void delete_or_not(int xt[2], int yt[2])//执行判断消除操作
{
	int start[2] = { (xt[0] - Len_Image / 2) / Len_Image,
		(yt[0] - Len_Image / 2) / Len_Image };//重新保存下标
	int end[2] = { (xt[1] - Len_Image / 2) / Len_Image,
		(yt[1] - Len_Image / 2) / Len_Image };

	if (TreeLines(start, end))//可以三条线以内消除
	{
		DrawTreeLines(start, end);//画消除路径
		Sleep(100);//等待路径显示
		Map[start[0]][start[1]] = 0;//清除这两个位置
		Map[end[0]][end[1]] = 0;
		remaining -= 2;//剩余字母数减2
		MoveMap();
		ShowMap();//刷新地图
	}
}
int find_step(int x, int y)//0代表已无解
{
	int start[2] = { x, y };//重新保存下标
	for (int i = 1; i < MapSize + 1; i++)
	{
		for (int j = 1; j < MapSize + 1; j++)
		{
			int end[2] = { i, j };
			if (!(x == i&&y == j)
				&& Map[i][j] == Map[x][y]
				&& TreeLines(start, end)
				&& Map[x][y] != 0)
				return 1;
		}
	}
	return 0;
}
void Show_helpstep(int kb_key)//显示提示
{
	for (int x = 1; x < MapSize + 1; x++)
	{
		for (int y = 1; y < MapSize + 1; y++)
		{
			int start[2] = { x, y };//重新保存下标
			for (int i = 1; i < MapSize + 1; i++)
			{
				for (int j = 1; j < MapSize + 1; j++)
				{
					int end[2] = { i, j };
					if (!(x == i&&y == j)
						&& Map[i][j] == Map[x][y]
						&& TreeLines(start, end)
						&& Map[x][y] != 0)
					{
						rectangle(
							i*Len_Image,
							j*Len_Image,
							(i + 1)*Len_Image,
							(j + 1)*Len_Image);
						rectangle(
							x*Len_Image,
							y*Len_Image,
							(x + 1)*Len_Image,
							(y + 1)*Len_Image);

						int start[2] = { i,j };//保存下标
						int end[2] = { x,y };
						DrawTreeLines(start, end);//画消除路径

						if (kb_key != 9)//如果不是Tab键消除 就长时间显示路径
						     Sleep(100);//等待路径显示
						else
							Sleep(5);//等待路径显示

						Map[start[0]][start[1]] = 0;//清除这两个位置
						Map[end[0]][end[1]] = 0;
						remaining -= 2;//剩余字母数减2
						MoveMap();
						ShowMap();//刷新地图
						return;
					}
				}
			}
		}
	}
}
int Find_step_onexit()
{
	int flag = 0;
	for (int i = 1; i < MapSize + 1; i++)
		for (int j = 1; j < MapSize + 1; j++)
			if (find_step(i, j))//有解
				return 1;

	return 0;
}
//打开随机bgm预备播放
void Openmusic()
{
    mciSendStringA("close bmusic1", 0, 0, 0);
    mciSendStringA("open \"sound\\Cyberangel - hanser.mp3\" type mpegvideo alias bmusic1",0,0,0);
}



// 播放背景音乐
void Playmusic()
{
    mciSendStringA("play bmusic1 repeat",0,0,0);
}



// 停止播放背景音乐
void Closemusic()
{
    mciSendStringA("close bmusic1",0,0,0);
}
int judge_game()
{
    if (remaining == 0) {
        pause_flag=1;
        int answer=MessageBoxA(GetHWnd(),"闯关成功，是否开始下一关？","连连看",MB_YESNO);
        Show_time(NULL);
        if(answer!=IDYES) { closegraph(); exit(0); }
        ++guan_count; Oninit_all(); CreateMap(); ShowMap(); return 0;
    }
    if (resist_time <= 0) {
        pause_flag=1;
        int answer=MessageBoxA(GetHWnd(),"时间到，是否重新开始？","连连看",MB_YESNO);
        Show_time(NULL);
        if(answer!=IDYES) { closegraph(); exit(0); }
        guan_count=1; Oninit_all(); CreateMap(); ShowMap(); return 0;
    }
    if (!Find_step_onexit()) {
        for(int i=0;i<100 && !Find_step_onexit();++i) xipai();
        if (!Find_step_onexit()) {
            // Bounded fallback keeps every remaining tile and places equal pairs adjacent.
            char values[MapSize*MapSize]; int n=0;
            for(int y=1;y<=MapSize;++y) for(int x=1;x<=MapSize;++x) if(Map[x][y]) values[n++]=Map[x][y];
            std::sort(values,values+n); memset(Map,0,sizeof(Map));
            for(int i=0;i<n;++i) Map[i%MapSize+1][i/MapSize+1]=values[i];
        }
        ShowMap();
    }
    return 0;
}

void startgame()
{
    pause_flag=1;
    int res=Msg(GetHWnd(),"请选择模式","连连看",MB_YESNO);
    if(res==IDNO) Read_game(); else { Oninit_all(); CreateMap(); }
    Show_time(NULL); ShowMap(); Openmusic(); Playmusic();
    while(IsWindow(GetHWnd())) {
        Show_time(NULL); Get_Mouse(); get_kbeve(); judge_game(); Sleep(5);
    }
}
void restart_game()
{
	Oninit_all();
	startgame();
}
